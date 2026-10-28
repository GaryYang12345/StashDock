//! Two active native renderers across Desktop and independent plugin hosts.
//! Advisory file locks are kernel owned: no broker, idle worker or stale PID
//! files. The renderer inherits its lease, so killing a host cannot release a
//! slot while its child is still shutting down.
use std::{
    fs::{self, File, OpenOptions},
    io,
    os::{
        fd::{AsRawFd, FromRawFd},
        unix::{
            fs::{DirBuilderExt, MetadataExt, OpenOptionsExt},
            process::CommandExt,
        },
    },
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};

pub struct Permit(File);

impl Permit {
    pub fn inherit(&self, command: &mut Command) {
        let fd = self.0.as_raw_fd();
        // SAFETY: pre_exec runs only the async-signal-safe fcntl call. The
        // parent's descriptor retains CLOEXEC; this child keeps the same open
        // file description (and hence the lease) until it exits. Permit stays
        // alive through spawn and the renderer's bounded termination.
        unsafe {
            command.pre_exec(move || {
                if libc::fcntl(fd, libc::F_SETFD, 0) == -1 {
                    return Err(io::Error::last_os_error());
                }
                Ok(())
            });
        }
    }
}

fn directory() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .ok_or("The renderer work slot is unavailable.")?;
    Ok(home.join("Library/Caches/app.stashdock.preview/admission-v1"))
}

fn slots(root: &Path) -> io::Result<[File; 2]> {
    let context =
        |step: &str, error: io::Error| io::Error::new(error.kind(), format!("{step}: {error}"));
    let mut builder = fs::DirBuilder::new();
    builder
        .recursive(true)
        .mode(0o700)
        .create(root)
        .map_err(|error| context("Create lease directory", error))?;
    let directory = OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
        .open(root)
        .map_err(|error| context("Open lease directory", error))?;
    let metadata = directory.metadata()?;
    if metadata.uid() != unsafe { libc::getuid() } || metadata.mode() & 0o077 != 0 {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "Invalid renderer lease directory",
        ));
    }
    let open = |name: &std::ffi::CStr| -> io::Result<File> {
        // Fixed names relative to an already opened, private directory. Never
        // follow a substituted symlink or truncate a lease another host holds.
        let flags = libc::O_RDWR | libc::O_NOFOLLOW | libc::O_CLOEXEC;
        let mut fd = unsafe {
            libc::openat(
                directory.as_raw_fd(),
                name.as_ptr(),
                flags | libc::O_CREAT | libc::O_EXCL,
                0o600,
            )
        };
        // Exactly one host creates a slot; peers open that same inode. A plain
        // concurrent O_CREAT open returned ENOENT on the tested Mac filesystem.
        if fd == -1 && io::Error::last_os_error().raw_os_error() == Some(libc::EEXIST) {
            fd = unsafe { libc::openat(directory.as_raw_fd(), name.as_ptr(), flags) };
        }
        if fd == -1 {
            return Err(context("Open lease file", io::Error::last_os_error()));
        }
        let file = unsafe { File::from_raw_fd(fd) };
        let metadata = file.metadata()?;
        if !metadata.is_file()
            || metadata.uid() != unsafe { libc::getuid() }
            || metadata.nlink() != 1
            || metadata.mode() & 0o077 != 0
        {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "Invalid renderer lease",
            ));
        }
        Ok(file)
    };
    Ok([open(c"slot-0")?, open(c"slot-1")?])
}

fn acquire_in(root: &Path, stop: &AtomicBool, deadline: Instant) -> Result<Permit, String> {
    if stop.load(Ordering::Relaxed) || Instant::now() >= deadline {
        return Err("Capture cancelled or timed out.".into());
    }
    let files = slots(root).map_err(|error| {
        eprintln!("Renderer admission: {error}");
        "The renderer could not reserve its work slot."
    })?;
    loop {
        if stop.load(Ordering::Relaxed) || Instant::now() >= deadline {
            return Err("Capture cancelled or timed out.".into());
        }
        for file in &files {
            if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0 {
                // The duplicate keeps this open description and its lease
                // alive after the temporary descriptors close.
                return Ok(Permit(
                    file.try_clone()
                        .map_err(|_| "The renderer work slot is unavailable.")?,
                ));
            }
            let error = io::Error::last_os_error();
            if !matches!(
                error.kind(),
                io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
            ) {
                return Err("The renderer work slot is unavailable.".into());
            }
        }
        // Only a live, bounded capture waits. Nothing polls while idle; its
        // original deadline and cancellation flag also bound admission.
        thread::sleep(
            Duration::from_millis(25).min(deadline.saturating_duration_since(Instant::now())),
        );
    }
}

pub fn acquire(stop: &AtomicBool, deadline: Instant) -> Result<Permit, String> {
    acquire_in(&directory()?, stop, deadline)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Stdio;

    #[test]
    fn concurrent_hosts_can_create_the_lease_directory_once() {
        for _ in 0..4 {
            let root =
                std::env::temp_dir().join(format!("stashdock-leases-{}", uuid::Uuid::new_v4()));
            let barrier = std::sync::Arc::new(std::sync::Barrier::new(8));
            let children: Vec<_> = (0..8)
                .map(|_| {
                    let root = root.clone();
                    let barrier = barrier.clone();
                    thread::spawn(move || {
                        barrier.wait();
                        slots(&root).map(drop)
                    })
                })
                .collect();
            for child in children {
                child.join().unwrap().unwrap();
            }
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn inherited_lease_child() {
        let Some(marker) = std::env::var_os("STASHDOCK_LEASE_TEST_MARKER") else {
            return;
        };
        fs::write(marker, b"ready").unwrap();
        thread::sleep(Duration::from_secs(8));
    }

    #[test]
    fn two_slots_recover_after_host_drop_and_child_termination() {
        let root = std::env::temp_dir().join(format!("stashdock-leases-{}", uuid::Uuid::new_v4()));
        let stop = AtomicBool::new(false);
        let deadline = || Instant::now() + Duration::from_millis(120);
        let first = acquire_in(&root, &stop, deadline()).unwrap();
        let second = acquire_in(&root, &stop, deadline()).unwrap();
        assert!(acquire_in(&root, &stop, deadline()).is_err());
        let marker = root.join("child-ready");
        let mut command = Command::new(std::env::current_exe().unwrap());
        command
            .args([
                "--exact",
                "preview_browser::admission::tests::inherited_lease_child",
                "--nocapture",
            ])
            .env("STASHDOCK_LEASE_TEST_MARKER", &marker)
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        first.inherit(&mut command);
        let mut child = command.spawn().unwrap();
        let until = Instant::now() + Duration::from_secs(3);
        while !marker.exists() && Instant::now() < until {
            thread::sleep(Duration::from_millis(10));
        }
        assert!(marker.exists(), "lease test child did not start");
        drop(first);
        let still_held = acquire_in(&root, &stop, deadline()).is_err();
        child.kill().unwrap();
        child.wait().unwrap();
        assert!(
            still_held,
            "dropping the host released a live child's lease"
        );
        let recovered = acquire_in(&root, &stop, deadline()).unwrap();
        stop.store(true, Ordering::Relaxed);
        assert!(acquire_in(&root, &stop, deadline()).is_err());
        drop((second, recovered));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn substituted_lease_symlinks_are_rejected() {
        let root = std::env::temp_dir().join(format!("stashdock-leases-{}", uuid::Uuid::new_v4()));
        drop(slots(&root).unwrap());
        fs::remove_file(root.join("slot-0")).unwrap();
        std::os::unix::fs::symlink("slot-1", root.join("slot-0")).unwrap();
        assert!(slots(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
