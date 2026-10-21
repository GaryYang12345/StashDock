//! Product state, independent of HWNDs and callers. System commands, app
//! buttons, shortcuts and tray actions all resolve through this policy.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Panel,
    Folder,
    Minimized,
    Hidden,
}
#[derive(Clone, Copy, Debug)]
pub enum Intent {
    Open,
    Minimize,
    Toggle,
    Hide,
    ShowLast,
}

pub fn resolve(mode: Mode, last: Mode, floating: bool, intent: Intent) -> Mode {
    let collapsed = if floating {
        Mode::Folder
    } else {
        Mode::Minimized
    };
    match intent {
        Intent::Open => Mode::Panel,
        Intent::Minimize => collapsed,
        Intent::Hide => Mode::Hidden,
        Intent::ShowLast => {
            if floating && last == Mode::Folder {
                Mode::Folder
            } else {
                Mode::Panel
            }
        }
        Intent::Toggle => {
            if mode == Mode::Hidden {
                resolve(mode, last, floating, Intent::ShowLast)
            } else if mode == Mode::Panel {
                collapsed
            } else {
                Mode::Panel
            }
        }
    }
}

pub fn preference_mode(mode: Mode, floating: bool) -> Mode {
    match (mode, floating) {
        (Mode::Folder, false) => Mode::Panel,
        (Mode::Minimized, true) => Mode::Folder,
        _ => mode,
    }
}

/// Reconcile current native facts, not an old queued event's payload. Focus
/// loss alone has no effect. Hidden is an explicit opt-out, never minimized.
pub fn native_intent(mode: Mode, panel_visible: bool, panel_minimized: bool) -> Option<Intent> {
    match (mode, panel_visible, panel_minimized) {
        (Mode::Panel, true, true) => Some(Intent::Minimize),
        (Mode::Folder | Mode::Minimized, true, false) => Some(Intent::Open),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_minimize_entrypoints_share_the_floating_policy() {
        for floating in [false, true] {
            let expected = if floating {
                Mode::Folder
            } else {
                Mode::Minimized
            };
            assert_eq!(
                resolve(Mode::Panel, Mode::Panel, floating, Intent::Minimize),
                expected
            );
            assert_eq!(
                resolve(Mode::Panel, Mode::Panel, floating, Intent::Toggle),
                expected
            );
            let native = native_intent(Mode::Panel, true, true).unwrap();
            assert_eq!(
                resolve(Mode::Panel, Mode::Panel, floating, native),
                expected
            );
        }
    }
    #[test]
    fn repeated_native_taskbar_cycles_never_enter_hidden() {
        for floating in [false, true] {
            let mut mode = Mode::Panel;
            for _ in 0..100 {
                mode = resolve(
                    mode,
                    mode,
                    floating,
                    native_intent(mode, true, true).unwrap(),
                );
                assert_eq!(
                    mode,
                    if floating {
                        Mode::Folder
                    } else {
                        Mode::Minimized
                    }
                );
                assert!(native_intent(mode, true, true).is_none()); // Our own minimize notification.
                mode = resolve(
                    mode,
                    mode,
                    floating,
                    native_intent(mode, true, false).unwrap(),
                );
                assert_eq!(mode, Mode::Panel);
                assert!(native_intent(mode, true, false).is_none()); // Our own restore notification.
            }
        }
    }
    #[test]
    fn stale_notifications_and_focus_changes_cannot_resurrect_hidden_windows() {
        for visible in [false, true] {
            for minimized in [false, true] {
                assert!(native_intent(Mode::Hidden, visible, minimized).is_none());
            }
        }
        assert!(native_intent(Mode::Panel, true, false).is_none());
        assert!(native_intent(Mode::Folder, false, false).is_none());
        assert_eq!(
            resolve(Mode::Minimized, Mode::Panel, true, Intent::Toggle),
            Mode::Panel
        );
        assert_eq!(
            resolve(Mode::Hidden, Mode::Folder, false, Intent::ShowLast),
            Mode::Panel
        );
    }
    #[test]
    fn preference_changes_and_shortcut_races_use_the_same_valid_modes() {
        assert_eq!(preference_mode(Mode::Minimized, true), Mode::Folder);
        assert_eq!(preference_mode(Mode::Folder, false), Mode::Panel);
        assert_eq!(preference_mode(Mode::Hidden, true), Mode::Hidden);
        for floating in [false, true] {
            let observed = resolve(
                Mode::Panel,
                Mode::Panel,
                floating,
                native_intent(Mode::Panel, true, true).unwrap(),
            );
            assert_eq!(
                resolve(observed, Mode::Panel, floating, Intent::Toggle),
                Mode::Panel
            );
            assert_eq!(
                resolve(observed, Mode::Panel, floating, Intent::Hide),
                Mode::Hidden
            );
            assert_eq!(
                resolve(Mode::Hidden, Mode::Folder, floating, Intent::Toggle),
                if floating { Mode::Folder } else { Mode::Panel }
            );
        }
    }
}
