//! Two active public renderers per user/session, including separate MCP hosts.
//! Named mutex slots recover automatically if an owning helper is terminated.
use std::{
    hash::{Hash, Hasher},
    sync::atomic::{AtomicBool, Ordering},
    time::Instant,
};
use windows_sys::Win32::{
    Foundation::{CloseHandle, HANDLE, WAIT_ABANDONED_0, WAIT_OBJECT_0, WAIT_TIMEOUT},
    System::Threading::{CreateMutexW, ReleaseMutex, WaitForMultipleObjects},
};

pub struct Permit {
    handles: [HANDLE; 2],
    owned: usize,
}
impl Drop for Permit {
    fn drop(&mut self) {
        unsafe {
            if self.owned < self.handles.len() {
                ReleaseMutex(self.handles[self.owned]);
            }
            for handle in self.handles {
                if !handle.is_null() {
                    CloseHandle(handle);
                }
            }
        }
    }
}
pub fn acquire(stop: &AtomicBool, deadline: Instant) -> Result<Permit, String> {
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    std::env::var_os("LOCALAPPDATA").hash(&mut hash);
    let scope = hash.finish();
    let mut permit = Permit {
        handles: [std::ptr::null_mut(); 2],
        owned: usize::MAX,
    };
    for index in 0..2 {
        let name: Vec<u16> = format!("Local\\StashDockPublicRenderer-v1-{scope:016x}-{index}")
            .encode_utf16()
            .chain(Some(0))
            .collect();
        permit.handles[index] = unsafe { CreateMutexW(std::ptr::null(), 0, name.as_ptr()) };
        if permit.handles[index].is_null() {
            return Err("The renderer could not reserve its work slot.".into());
        }
    }
    while !stop.load(Ordering::Relaxed) && Instant::now() < deadline {
        let wait = unsafe { WaitForMultipleObjects(2, permit.handles.as_ptr(), 0, 50) };
        let index = if (WAIT_OBJECT_0..WAIT_OBJECT_0 + 2).contains(&wait) {
            wait - WAIT_OBJECT_0
        } else if (WAIT_ABANDONED_0..WAIT_ABANDONED_0 + 2).contains(&wait) {
            wait - WAIT_ABANDONED_0
        } else if wait == WAIT_TIMEOUT {
            continue;
        } else {
            return Err("The renderer work slot is unavailable.".into());
        };
        permit.owned = index as usize;
        return Ok(permit);
    }
    Err("Capture cancelled or timed out.".into())
}
