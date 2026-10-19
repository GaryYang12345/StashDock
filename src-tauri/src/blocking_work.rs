//! Fail-fast admission for expensive blocking work. A cancelled waiter cannot
//! release a live worker's reservation; the worker owns it until completion.
use std::sync::atomic::{AtomicUsize, Ordering};
pub(crate) struct WorkLimit {
    active: AtomicUsize,
    maximum: usize,
}
struct Reservation<'a>(&'a WorkLimit);
impl Drop for Reservation<'_> {
    fn drop(&mut self) {
        self.0.active.fetch_sub(1, Ordering::Relaxed);
    }
}
impl WorkLimit {
    pub(crate) const fn new(maximum: usize) -> Self {
        Self {
            active: AtomicUsize::new(0),
            maximum,
        }
    }
    fn reserve(&self) -> Result<Reservation<'_>, String> {
        self.active
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |n| {
                (n < self.maximum).then_some(n + 1)
            })
            .map(|_| Reservation(self))
            .map_err(|_| "StashDock is busy. Try again.".into())
    }
    pub(crate) async fn run<T: Send + 'static>(
        &'static self,
        task: impl FnOnce() -> Result<T, String> + Send + 'static,
    ) -> Result<T, String> {
        let reservation = self.reserve()?;
        tauri::async_runtime::spawn_blocking(move || {
            let _reservation = reservation;
            task()
        })
        .await
        .map_err(|_| "The operation failed. Try again.".to_string())?
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn work_is_bounded_and_error_unwind_releases_its_slot() {
        let limit = WorkLimit::new(4);
        let guards: Vec<_> = (0..4).map(|_| limit.reserve().unwrap()).collect();
        assert!(limit.reserve().is_err());
        drop(guards);
        let _ = std::panic::catch_unwind(|| {
            let _guard = limit.reserve().unwrap();
            panic!("isolated failure");
        });
        assert_eq!(limit.active.load(Ordering::Relaxed), 0);
        assert!(limit.reserve().is_ok());
    }
}
