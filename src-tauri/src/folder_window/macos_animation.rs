//! Event-driven Core Animation; three pre-rendered layers from the shared artwork.
//! Only layer transforms animate. Native window geometry and hit targets stay fixed.
use objc2::{rc::Retained, AnyThread};
use objc2_app_kit::{NSImage, NSWorkspace};
use objc2_foundation::{NSData, NSPoint, NSRect, NSSize, NSString, NSValue};
use objc2_quartz_core::{
    kCAFillModeBackwards, CABasicAnimation, CACurrentMediaTime, CALayer, CAMediaTiming,
    CAMediaTimingFunction, CATransaction, CATransform3D, CATransform3DEqualToTransform,
    CATransform3DMakeScale, CATransform3DMakeTranslation, NSValueCATransform3DAdditions,
};
use std::cell::Cell;

pub struct Artwork {
    pub root: Retained<CALayer>,
    cards: Retained<CALayer>,
    up: Cell<f64>,
}

// Windows: lift the surface 2px, scale 1.012, raise cards 3 SVG units.
// The Mac accessory is the same composition at 90%; SVG units map at 144/360.
fn visual_up(flipped: bool) -> f64 {
    if flipped {
        -1.0
    } else {
        1.0
    }
}

fn target(hovered: bool, pressed: bool, reduced: bool) -> (f64, f64, f64) {
    if reduced {
        (1.0, 0.0, 0.0)
    } else if pressed {
        (0.985, 0.0, if hovered { 1.2 } else { 0.0 })
    } else if hovered {
        (1.012, 1.8, 1.2)
    } else {
        (1.0, 0.0, 0.0)
    }
}

impl Artwork {
    pub fn new() -> Result<Self, String> {
        let root = CALayer::new();
        root.setFrame(NSRect::new(
            NSPoint::new(0.0, 0.0),
            NSSize::new(144.0, 144.0),
        ));
        root.setMasksToBounds(false);
        let mut cards = None;
        for (name, bytes) in [
            (
                "rear",
                include_bytes!(concat!(env!("OUT_DIR"), "/floating-folder-rear.png")).as_slice(),
            ),
            (
                "cards",
                include_bytes!(concat!(env!("OUT_DIR"), "/floating-folder-cards.png")).as_slice(),
            ),
            (
                "front",
                include_bytes!(concat!(env!("OUT_DIR"), "/floating-folder-front.png")).as_slice(),
            ),
        ] {
            let image = NSImage::initWithData(NSImage::alloc(), &NSData::with_bytes(bytes))
                .ok_or("The folder artwork is unavailable.")?;
            // CGImage is retained by CALayer.contents; decoded once, never per frame.
            let cg = unsafe {
                image.CGImageForProposedRect_context_hints(std::ptr::null_mut(), None, None)
            }
            .ok_or("The folder image could not be decoded.")?;
            let layer = CALayer::new();
            layer.setFrame(root.bounds());
            layer.setContentsScale(3.0);
            let pointer: *const objc2_core_graphics::CGImage = &*cg;
            unsafe {
                layer.setContents(Some(&*pointer.cast::<objc2::runtime::AnyObject>()));
            }
            root.addSublayer(&layer);
            if name == "cards" {
                cards = Some(layer);
            }
        }
        Ok(Self {
            root,
            cards: cards.expect("Shared cards layer"),
            up: Cell::new(1.0),
        })
    }

    pub fn set_coordinates(&self, flipped: bool) {
        // NSButton can use a flipped backing coordinate system. Match CSS's
        // top-left transform origin and convert visual UP at this boundary.
        self.up.set(visual_up(flipped));
        self.root
            .setAnchorPoint(NSPoint::new(0.0, if flipped { 0.0 } else { 1.0 }));
        self.root
            .setPosition(NSPoint::new(0.0, if flipped { 0.0 } else { 144.0 }));
    }

    pub fn update(&self, hovered: bool, pressed: bool, immediate: bool) {
        self.update_after(hovered, pressed, immediate, 0.0);
    }

    pub fn update_after(&self, hovered: bool, pressed: bool, immediate: bool, delay: f64) {
        let reduced = NSWorkspace::sharedWorkspace().accessibilityDisplayShouldReduceMotion();
        let (scale, lift, cards) = target(hovered, pressed, reduced);
        let mut surface = CATransform3DMakeScale(scale, scale, 1.0);
        surface.m42 = lift * self.up.get();
        animate(&self.root, surface, reduced || immediate, 0.24, delay);
        animate(
            &self.cards,
            CATransform3DMakeTranslation(0.0, cards * self.up.get(), 0.0),
            reduced || immediate,
            0.24,
            delay,
        );
    }
}

fn animate(layer: &CALayer, target: CATransform3D, immediate: bool, duration: f64, delay: f64) {
    if !immediate && CATransform3DEqualToTransform(layer.transform(), target) {
        return;
    }
    // Read the visible state before replacing the animation: rapid reversals do
    // not jump back to a stale model value. No timers or display-link callbacks.
    let current = unsafe { layer.presentationLayer() }
        .map_or_else(|| layer.transform(), |layer| layer.transform());
    CATransaction::begin();
    CATransaction::setDisableActions(true);
    layer.setTransform(target);
    CATransaction::commit();
    let key = NSString::from_str("folder-feedback");
    if immediate {
        layer.removeAnimationForKey(&key);
        return;
    }
    let animation = CABasicAnimation::animationWithKeyPath(Some(&NSString::from_str("transform")));
    unsafe {
        animation.setFromValue(Some(&NSValue::valueWithCATransform3D(current)));
        animation.setToValue(Some(&NSValue::valueWithCATransform3D(target)));
    }
    animation.setDuration(duration);
    // The same 260ms release hold as FloatingFolder. The compositor owns the
    // delay; re-enter/press replaces it immediately without a stale timer.
    animation.setBeginTime(layer.convertTime_fromLayer(CACurrentMediaTime(), None) + delay);
    animation.setFillMode(unsafe { kCAFillModeBackwards });
    animation.setTimingFunction(Some(&CAMediaTimingFunction::functionWithControlPoints(
        0.22, 1.0, 0.36, 1.0,
    )));
    layer.addAnimation_forKey(&animation, Some(&key));
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unchanged_feedback_does_not_restart_the_current_transition() {
        let layer = CALayer::new();
        let raised = CATransform3DMakeTranslation(0.0, 1.8, 0.0);
        let key = NSString::from_str("folder-feedback");
        animate(&layer, raised, false, 0.24, 0.0);
        // SAFETY: This test owns the layer and reads its animation on the same thread.
        let start = unsafe { layer.animationForKey(&key) }.unwrap().beginTime();
        animate(&layer, raised, false, 0.24, 0.26);
        assert_eq!(
            unsafe { layer.animationForKey(&key) }.unwrap().beginTime(),
            start
        );
    }
    #[test]
    fn delayed_release_holds_the_visible_pose_and_immediate_reset_cancels_it() {
        let layer = CALayer::new();
        layer.setTransform(CATransform3DMakeTranslation(0.0, 1.8, 0.0));
        let rest = CATransform3DMakeScale(1.0, 1.0, 1.0);
        let key = NSString::from_str("folder-feedback");
        let before = CACurrentMediaTime();
        animate(&layer, rest, false, 0.24, 0.26);
        // SAFETY: Only this test can mutate the owned layer or its animations.
        let animation = unsafe { layer.animationForKey(&key) }.unwrap();
        assert!(animation.beginTime() >= before + 0.26);
        assert_eq!(&*animation.fillMode(), unsafe { kCAFillModeBackwards });
        animate(&layer, rest, true, 0.24, 0.0);
        assert!(unsafe { layer.animationForKey(&key) }.is_none());
    }
    #[test]
    fn hover_lifts_up_in_both_native_coordinate_systems() {
        for flipped in [false, true] {
            let (_, surface, cards) = target(true, false, false);
            let screen_direction = if flipped { 1.0 } else { -1.0 };
            assert!(surface * visual_up(flipped) * screen_direction < 0.0);
            assert!(cards * visual_up(flipped) * screen_direction < 0.0);
        }
    }
    #[test]
    fn motion_matches_hover_press_exit_and_reduce_motion_contract() {
        assert_eq!(target(false, false, false), (1.0, 0.0, 0.0));
        assert_eq!(target(true, false, false), (1.012, 1.8, 1.2));
        assert_eq!(target(true, true, false), (0.985, 0.0, 1.2));
        for hover in [false, true] {
            for press in [false, true] {
                assert_eq!(target(hover, press, true), (1.0, 0.0, 0.0));
            }
        }
    }
}
