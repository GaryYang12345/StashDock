//! The standalone desktop is shell-owned, not host-owned, even when a launcher
//! uses process-tree cleanup instead of a Job Object.
#[cfg(windows)]
mod windows {
    use std::{ffi::OsStr, mem, os::windows::ffi::OsStrExt, path::Path, ptr};
    use windows_sys::Win32::{
        Foundation::{CloseHandle, HANDLE},
        System::{JobObjects::IsProcessInJob, Threading::*},
        UI::WindowsAndMessaging::{GetShellWindow, GetWindowThreadProcessId},
    };
    fn wide(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(Some(0)).collect()
    }
    pub fn in_job(process: HANDLE) -> std::io::Result<bool> {
        let mut result = 0;
        // SAFETY: process is a live owned handle or the current-process pseudo handle.
        if unsafe { IsProcessInJob(process, ptr::null_mut(), &mut result) } == 0 {
            return Err(std::io::Error::last_os_error());
        }
        Ok(result != 0)
    }
    pub struct Child {
        pub process: HANDLE,
        thread: HANDLE,
    }
    impl Drop for Child {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.thread);
                CloseHandle(self.process);
            }
        }
    }
    pub fn needs_handoff(marked: bool, in_launcher_job: bool) -> std::io::Result<bool> {
        if marked && in_launcher_job {
            return Err(std::io::Error::other(
                "Independent startup still belongs to a launcher job.",
            ));
        }
        Ok(!marked)
    }
    pub fn from_shell(exe: &Path, suspended: bool) -> std::io::Result<Child> {
        from_shell_command(exe, "--stashdock-independent", suspended)
    }
    pub fn from_shell_command(
        exe: &Path,
        arguments: &str,
        suspended: bool,
    ) -> std::io::Result<Child> {
        // Use the interactive Windows shell as the documented creation parent.
        // This launches only our own executable, without modifying or terminating Explorer.
        let mut pid = 0;
        unsafe {
            GetWindowThreadProcessId(GetShellWindow(), &mut pid);
        }
        if pid == 0 {
            return Err(std::io::Error::other(
                "The Windows desktop shell is unavailable.",
            ));
        }
        let parent = unsafe { OpenProcess(PROCESS_CREATE_PROCESS, 0, pid) };
        if parent.is_null() {
            return Err(std::io::Error::last_os_error());
        }
        let mut size = 0;
        unsafe {
            InitializeProcThreadAttributeList(ptr::null_mut(), 1, 0, &mut size);
        }
        // usize storage supplies the alignment required by the opaque attribute list.
        let mut storage = vec![0usize; size.div_ceil(mem::size_of::<usize>())];
        let list = storage.as_mut_ptr().cast();
        let initialized = unsafe { InitializeProcThreadAttributeList(list, 1, 0, &mut size) } != 0;
        let result = (|| {
            if !initialized {
                return Err(std::io::Error::last_os_error());
            }
            if unsafe {
                UpdateProcThreadAttribute(
                    list,
                    0,
                    PROC_THREAD_ATTRIBUTE_PARENT_PROCESS as usize,
                    &parent as *const _ as _,
                    mem::size_of::<HANDLE>(),
                    ptr::null_mut(),
                    ptr::null(),
                )
            } == 0
            {
                return Err(std::io::Error::last_os_error());
            }
            let executable = wide(exe.as_os_str());
            let mut command = wide(OsStr::new(&format!("\"{}\" {arguments}", exe.display())));
            let mut startup: STARTUPINFOEXW = unsafe { mem::zeroed() };
            startup.StartupInfo.cb = mem::size_of::<STARTUPINFOEXW>() as u32;
            startup.lpAttributeList = list;
            let mut info: PROCESS_INFORMATION = unsafe { mem::zeroed() };
            let flags = EXTENDED_STARTUPINFO_PRESENT | CREATE_NO_WINDOW | CREATE_SUSPENDED;
            // SAFETY: all buffers/handles remain live through CreateProcessW. No
            // handles are inherited; the OS supplies the shell's job/token context.
            if unsafe {
                CreateProcessW(
                    executable.as_ptr(),
                    command.as_mut_ptr(),
                    ptr::null(),
                    ptr::null(),
                    0,
                    flags,
                    ptr::null(),
                    ptr::null(),
                    &startup.StartupInfo,
                    &mut info,
                )
            } == 0
            {
                return Err(std::io::Error::last_os_error());
            }
            let child = Child {
                process: info.hProcess,
                thread: info.hThread,
            };
            // Verify before user code executes. Never leave a live replacement
            // behind if checking/resuming fails, and never inherit stdio handles.
            let activate = (|| {
                if in_job(child.process)? {
                    return Err(std::io::Error::other(
                        "The shell launch still belongs to a launcher job.",
                    ));
                }
                if !suspended && unsafe { ResumeThread(child.thread) } == u32::MAX {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            })();
            if let Err(error) = activate {
                unsafe {
                    TerminateProcess(child.process, 1);
                    WaitForSingleObject(child.process, 5000);
                }
                return Err(error);
            }
            Ok(child)
        })();
        unsafe {
            if initialized {
                DeleteProcThreadAttributeList(list);
            }
            CloseHandle(parent);
        }
        result
    }
    pub fn relaunch() -> std::io::Result<bool> {
        let marked = std::env::args_os().any(|arg| arg == "--stashdock-independent");
        if !needs_handoff(marked, in_job(unsafe { GetCurrentProcess() })?)? {
            return Ok(false);
        }
        let _child = from_shell(&std::env::current_exe()?, false)?;
        Ok(true)
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn initial_launch_is_always_handed_off_and_markers_cannot_bypass_job_validation() {
            assert!(needs_handoff(false, false).unwrap());
            assert!(needs_handoff(false, true).unwrap());
            assert!(!needs_handoff(true, false).unwrap());
            assert!(needs_handoff(true, true).is_err());
        }
        #[test]
        fn standalone_shell_child_does_not_inherit_the_test_launchers_job() {
            // The child never runs code or opens a window. It is our suspended
            // test executable, not the actual user app or a user browser.
            let child = from_shell(&std::env::current_exe().unwrap(), true).unwrap();
            let outside = in_job(child.process).unwrap();
            unsafe {
                TerminateProcess(child.process, 0);
                WaitForSingleObject(child.process, 5000);
            }
            assert!(!outside, "Desktop launch inherited its parent's Job Object");
        }
    }
}
pub fn spawn_connector(executable: &std::path::Path, root: &std::path::Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        let raw = root.to_string_lossy();
        // Windows filenames cannot contain quotes. Escape trailing backslashes
        // so even a data-directory argument ending in a separator stays one arg.
        if raw.contains('"') {
            return Err("Invalid connector data directory.".into());
        }
        let trailing = raw.chars().rev().take_while(|c| *c == '\\').count();
        let arguments = format!("--connector-worker \"{}{}\"", raw, "\\".repeat(trailing));
        let child = windows::from_shell_command(executable, &arguments, false)
            .map_err(|_| "The independent X connector could not start.".to_string())?;
        if windows::in_job(child.process)
            .map_err(|_| "The X connector could not be checked.".to_string())?
        {
            return Err("The X connector could not start independently.".into());
        }
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = (executable, root);
        Err("Platform connections currently require Windows.".into())
    }
}
pub fn relaunch_if_needed() -> Result<bool, String> {
    // `tauri dev` stops its Vite server as soon as the process it started exits,
    // so a handed-off development window would load a refused localhost page.
    // Development builds stay attached to the developer's terminal instead.
    #[cfg(dev)]
    return Ok(false);
    #[cfg(all(windows, not(dev)))]
    {
        return windows::relaunch()
            .map_err(|error| format!("StashDock could not start independently: {error}"));
    }
    #[cfg(all(not(windows), not(dev)))]
    Ok(false)
}
