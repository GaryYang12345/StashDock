//! Presentation adapter only. DesktopWindows remains the mode/placement owner;
//! an asynchronous own-WebView snapshot may prepare a handoff, never commit one.
use crate::{desktop_window_policy::Mode, desktop_windows, folder_search};
use std::{cell::RefCell, ffi::c_void};
use tauri::{AppHandle, Manager};

type Reply = extern "C" fn(u64, bool);
extern "C" {
    fn stashdock_handoff_prepare(
        panel: *mut c_void,
        folder: *mut c_void,
        expand: bool,
        token: u64,
        ready: Reply,
        completed: Reply,
    ) -> bool;
    fn stashdock_handoff_stage(token: u64) -> bool;
    fn stashdock_handoff_play(token: u64);
    fn stashdock_handoff_cancel();
}
#[derive(Default)]
struct Presentation {
    generation: u64,
    pending: Option<(u64, Mode, AppHandle)>,
    prepared: Option<(u64, Mode)>,
    active: Option<(u64, AppHandle)>,
    focus_search: bool,
}
thread_local! { static PRESENTATION: RefCell<Presentation> = RefCell::default(); }
pub fn preparing() -> bool {
    PRESENTATION.with(|state| state.borrow().pending.is_some())
}
pub fn active() -> bool {
    PRESENTATION.with(|state| state.borrow().active.is_some())
}
pub fn focus_search_when_ready() {
    PRESENTATION.with(|state| state.borrow_mut().focus_search = true);
}
pub fn prepare(app: &AppHandle, target: Mode) -> bool {
    let Some(panel) = app.get_window("main") else {
        return false;
    };
    let Some(folder) = app.get_window("folder") else {
        return false;
    };
    let (Ok(panel), Ok(folder)) = (panel.ns_window(), folder.ns_window()) else {
        return false;
    };
    let token = PRESENTATION.with(|state| {
        let mut state = state.borrow_mut();
        state.generation += 1;
        let token = state.generation;
        state.pending = Some((token, target, app.clone()));
        if target != Mode::Folder {
            state.focus_search = false;
        }
        token
    });
    let accepted = unsafe {
        stashdock_handoff_prepare(
            panel,
            folder,
            target == Mode::Panel,
            token,
            ready,
            completed,
        )
    };
    if !accepted {
        PRESENTATION.with(|state| state.borrow_mut().pending = None);
    }
    accepted
}
extern "C" fn ready(token: u64, success: bool) {
    let pending = PRESENTATION.with(|state| {
        let mut state = state.borrow_mut();
        if state
            .pending
            .as_ref()
            .is_none_or(|pending| pending.0 != token)
        {
            return None;
        }
        let pending = state.pending.take()?;
        if success {
            state.prepared = Some((token, pending.1));
        }
        Some((pending, state.focus_search))
    });
    if let Some(((_, target, app), focus_search)) = pending {
        desktop_windows::complete_macos_handoff(&app, target);
        if focus_search && !active() && !preparing() {
            desktop_windows::focus_folder_search(&app);
        }
    }
}
pub fn take_prepared(target: Mode) -> Option<u64> {
    PRESENTATION.with(|state| {
        state
            .borrow_mut()
            .prepared
            .take()
            .filter(|(_, mode)| *mode == target)
            .map(|(token, _)| token)
    })
}
pub fn stage(token: u64, app: &AppHandle) -> bool {
    if !unsafe { stashdock_handoff_stage(token) } {
        cancel();
        return false;
    }
    PRESENTATION.with(|state| state.borrow_mut().active = Some((token, app.clone())));
    true
}
pub fn play(token: u64) {
    unsafe { stashdock_handoff_play(token) }
}
extern "C" fn completed(token: u64, _: bool) {
    let app = PRESENTATION.with(|state| {
        let mut state = state.borrow_mut();
        if state.active.as_ref().is_none_or(|active| active.0 != token) {
            return None;
        }
        let focus = std::mem::take(&mut state.focus_search);
        state.active.take().map(|(_, app)| (app, focus))
    });
    if let Some((app, focus)) = app {
        desktop_windows::macos_handoff_finished(&app);
        if focus {
            desktop_windows::focus_folder_search(&app);
        }
    }
}
pub fn cancel() {
    PRESENTATION.with(|state| {
        let mut state = state.borrow_mut();
        state.pending = None;
        state.prepared = None;
        state.active = None;
        state.focus_search = false;
    });
    unsafe { stashdock_handoff_cancel() }
}
pub fn suspend_search(app: &AppHandle) {
    folder_search::detach(app, true);
}
