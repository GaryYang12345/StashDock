// Public AppKit controls matching Arc SearchField and Button.
import AppKit
import QuartzCore

// Scalar springs share one trajectory across dependent properties. Width
// changes retain position; Motion time-defined springs reset inherited velocity.
@MainActor final class SearchScalarAnimation {
    private let bindings: [(CALayer,String,Double)]
    private var movement: SearchSpring?
    private var target: Double?
    init(_ bindings: [(CALayer,String,Double)]) { self.bindings = bindings }
    var value: Double { value(at:CACurrentMediaTime()) }
    var endTime:Double { movement.map { $0.start+$0.duration } ?? 0 }
    func value(at time:Double) -> Double {
        guard let movement else { return target ?? 0 }
        let elapsed = time-movement.start
        return elapsed >= movement.duration ? movement.to : movement.state(elapsed).value
    }
    func set(_ value:Double, spring:String, immediate:Bool = false) {
        guard target != value || immediate else { return }
        let now = CACurrentMediaTime(), previous = target
        let state:(Double,Double)
        if let movement, now-movement.start < movement.duration { state = movement.state(now-movement.start) }
        else { state = (previous ?? value,0) }
        target = value
        withoutActions { for (layer,key,factor) in bindings { layer.setValue(value*factor,forKeyPath:key) } }
        guard previous != nil, !immediate, !SearchDesign.reduced else {
            movement = nil; for (layer,key,_) in bindings { layer.removeAnimation(forKey:key) }; return
        }
        let physics = SearchDesign.spring(spring)
        let next = SearchSpring(from:state.0,to:value,velocity:SearchDesign.springIsTimeDefined(spring) ? 0 : state.1,stiffness:physics.0,damping:physics.1,start:now)
        movement = next
        let duration = next.duration, count = Int(ceil(duration*120))
        for (layer,key,factor) in bindings {
            let animation = CAKeyframeAnimation(keyPath:key)
            animation.values = (0...count).map { i in (i == count ? value : next.state(Double(i)/Double(count)*duration).value)*factor }
            animation.duration = duration; animation.beginTime = now; animation.calculationMode = .linear
            layer.add(animation,forKey:key)
        }
    }
}
@MainActor func searchScaleSpring(_ layer:CALayer, to:Double, spring:String, initial:Double? = nil) {
    let animation = SearchScalarAnimation([(layer,"transform.scale",1)])
    let start = initial ?? (layer.presentation()?.value(forKeyPath:"transform.scale") as? Double) ?? (layer.value(forKeyPath:"transform.scale") as? Double) ?? 1
    animation.set(start,spring:spring,immediate:true); animation.set(to,spring:spring)
}

@MainActor final class CenteredSearchCell: NSTextFieldCell {
    override func drawingRect(forBounds rect: NSRect) -> NSRect {
        var r = super.drawingRect(forBounds:rect)
        let height = ceil(cellSize.height)
        r.origin.y = rect.midY - height / 2; r.size.height = height
        return r
    }
    override func edit(withFrame rect: NSRect, in controlView: NSView, editor: NSText, delegate: Any?, event: NSEvent?) {
        super.edit(withFrame:drawingRect(forBounds:rect),in:controlView,editor:editor,delegate:delegate,event:event)
    }
    override func select(withFrame rect: NSRect, in controlView: NSView, editor: NSText, delegate: Any?, start selStart: Int, length selLength: Int) {
        super.select(withFrame:drawingRect(forBounds:rect),in:controlView,editor:editor,delegate:delegate,start:selStart,length:selLength)
    }
}
@MainActor final class SearchInput: NSTextField {
    weak var owner: SearchOwner?
    override var needsPanelToBecomeKey: Bool { true }
    override func cancelOperation(_ sender: Any?) { owner?.close(restoreFocus:true) }
}
@MainActor final class ClearSearchButton: NSButton {
    override var needsPanelToBecomeKey: Bool { true }
    weak var owner: SearchOwner?
    private var over = false
    private var shown = false
    private var hideWork: DispatchWorkItem?
    override init(frame: NSRect) {
        super.init(frame:frame); isBordered = false; title = ""; focusRingType = .default
        target = self; action = #selector(clear); wantsLayer = true; layer?.cornerRadius = 12
        blurLayer(layer!); isHidden = true; isEnabled = false
    }
    required init?(coder: NSCoder) { fatalError("No archives") }
    override func updateTrackingAreas() {
        super.updateTrackingAreas(); trackingAreas.forEach(removeTrackingArea)
        addTrackingArea(NSTrackingArea(rect:bounds,options:[.activeAlways,.mouseEnteredAndExited,.inVisibleRect],owner:self,userInfo:nil))
    }
    override func mouseEntered(with event:NSEvent) { over = true; refresh() }
    override func mouseExited(with event:NSEvent) { over = false; refresh() }
    override func mouseDown(with event:NSEvent) {
        if let layer { tween(layer,"transform.scale",to:0.96,duration:SearchDesign.duration("instant")) }
        super.mouseDown(with:event)
        if shown, let layer { searchScaleSpring(layer,to:1,spring:"snappy") }
    }
    func refresh() {
        guard let owner else { return }
        image = owner.controlImage("clear",role:over ? "foreground" : "text-muted")
        imageScaling = .scaleProportionallyDown
        layer?.backgroundColor = over ? owner.color("surface-muted").cgColor : NSColor.clear.cgColor
        needsDisplay = true
    }
    override func draw(_ dirtyRect: NSRect) { imageIn(image,NSRect(x:4,y:4,width:16,height:16)) }
    func setShown(_ visible:Bool, immediate:Bool = false) {
        guard shown != visible || immediate, let layer else { return }
        let initial = isHidden
        shown = visible; hideWork?.cancel(); hideWork = nil
        isEnabled = visible
        if immediate {
            isHidden = !visible; layer.removeAllAnimations()
            withoutActions { layer.opacity = visible ? 1 : 0; layer.transform = CATransform3DIdentity; layer.setValue(0,forKeyPath:"filters.searchBlur.inputRadius") }; return
        }
        isHidden = false
        if visible {
            if !SearchDesign.reduced { searchScaleSpring(layer,to:1,spring:"snappy",initial:initial ? SearchDesign.control("clearFoldScale") : nil) }
            tween(layer,"opacity",to:1.0,duration:SearchDesign.duration(SearchDesign.reduced ? "instant" : "fast"),from:initial ? 0 : nil)
            tween(layer,"filters.searchBlur.inputRadius",to:0.0,duration:SearchDesign.duration("fast"),from:initial ? SearchDesign.blur("subtle") : nil)
        } else {
            if !SearchDesign.reduced { tween(layer,"transform.scale",to:SearchDesign.control("clearFoldScale"),duration:SearchDesign.duration("instant")) }
            tween(layer,"opacity",to:0.0,duration:SearchDesign.reduced ? 0 : SearchDesign.duration("instant"))
            tween(layer,"filters.searchBlur.inputRadius",to:SearchDesign.reduced ? 0.0 : SearchDesign.blur("subtle"),duration:SearchDesign.duration("instant"))
            let work = DispatchWorkItem { [weak self] in guard self?.shown == false else { return }; self?.isHidden = true }
            hideWork = work; DispatchQueue.main.asyncAfter(deadline:.now()+(SearchDesign.reduced ? 0 : SearchDesign.duration("instant")),execute:work)
        }
    }
    @objc private func clear() { owner?.clearQuery() }
}
@MainActor final class SearchSurface: NSView {
    weak var owner: SearchOwner?
    let keyShadow = CALayer(), ambientShadow = CALayer(), rim = CAShapeLayer()
    override var isFlipped: Bool { true }
    override init(frame: NSRect) {
        super.init(frame:frame); wantsLayer = true; clipsToBounds = false
        layer?.addSublayer(ambientShadow); layer?.addSublayer(keyShadow)
        layer?.addSublayer(rim)
        blurLayer(layer!)
    }
    required init?(coder: NSCoder) { fatalError("No archives") }
    override func draw(_ dirtyRect:NSRect) {
        owner?.color("surface-raised").setFill()
        NSBezierPath(roundedRect:bounds,xRadius:22,yRadius:22).fill()
        // Borderless in Windows. Never add an AppKit separator around the pill.
    }
    func refresh() {
        guard let owner else { return }
        withoutActions {
        for shadow in [ambientShadow,keyShadow] {
            shadow.frame = bounds; shadow.cornerRadius = 22
            shadow.backgroundColor = owner.color("surface-raised").cgColor
        }
        configureSearchShadow(keyShadow,ambientShadow,rect:bounds,radius:22,dark:owner.dark)
        configureSearchRim(rim,rect:bounds,radius:22,dark:owner.dark)
        }
        needsDisplay = true
    }
}

// Arc Button's labelled phase, width morph and loading slot, without scaling
// text or re-rasterizing the cover when the clipboard state changes.
@MainActor final class SearchCopyPresentation {
    let root = CALayer(), labelHost = CALayer(), spinner = CAShapeLayer()
    private var phase: CALayer?, outgoing: CALayer?
    private var retirement: DispatchWorkItem?, stopSpinner: DispatchWorkItem?
    private var labelKey = "", styleKey = ""
    private var working = false, initialized = false
    private lazy var widthMotion = SearchScalarAnimation([(root,"bounds.size.width",1),(labelHost,"position.x",0.5),(spinner,"position.x",0.5)])
    var width:Double { widthMotion.value }
    var animationEnd:Double { widthMotion.endTime }
    func width(at time:Double) -> Double { widthMotion.value(at:time) }
    var targetWidth = 0.0
    init() {
        root.bounds = NSRect(x:0,y:0,width:0,height:36)
        root.anchorPoint = NSPoint(x:1,y:0.5); root.position = NSPoint(x:223,y:141); root.cornerRadius = 18; root.opacity = 0
        labelHost.position = NSPoint(x:0,y:18); root.addSublayer(labelHost)
        spinner.bounds = NSRect(x:0,y:0,width:16,height:16); spinner.position = NSPoint(x:0,y:18)
        spinner.path = CGPath(ellipseIn:NSRect(x:1,y:1,width:14,height:14),transform:nil)
        spinner.fillColor = nil; spinner.lineWidth = 1.5; spinner.strokeEnd = 0.75; spinner.opacity = 0
        blurLayer(spinner); root.addSublayer(spinner)
    }
    static func naturalWidth(_ label:String) -> Double {
        // Arc Button does not inherit the title's -.01em tracking.
        (label as NSString).size(withAttributes:[.font:SearchTypeface.font(14,medium:true),.kern:0]).width+50
    }
    func update(owner:SearchOwner, label:String, copied:Bool, pending:Bool, visible:Bool, buttonHovered:Bool) {
        let scale = owner.panel.backingScaleFactor
        let textWidth = Self.naturalWidth(label)-50
        targetWidth = textWidth + 50
        widthMotion.set(targetWidth,spring:"morph")
        let style = "\(owner.dark)-\(scale)"
        if labelKey != label || styleKey != style {
            let changed = !labelKey.isEmpty && labelKey != label
            retirement?.cancel(); outgoing?.removeFromSuperlayer(); outgoing = nil
            let old = phase, next = CALayer()
            next.bounds = NSRect(x:0,y:0,width:textWidth+24,height:36); next.position = .zero
            next.contentsScale = scale; blurLayer(next)
            next.contents = searchBitmap(next.bounds.size,scale:scale) {
                imageIn(owner.controlImage(copied ? "check" : "copy",role:"background"),NSRect(x:0,y:10,width:16,height:16))
                drawSearchText(label,rect:NSRect(x:24,y:0,width:textWidth,height:36),size:14,medium:true,color:owner.color("background"),tracking:0)
            }
            labelHost.addSublayer(next); phase = next; labelKey = label; styleKey = style
            if changed && !SearchDesign.reduced {
                tween(next,"position.y",to:0.0,duration:SearchDesign.duration("standard"),ease:"enter",from:SearchDesign.control("labelInY"))
                tween(next,"opacity",to:1.0,duration:SearchDesign.duration("standard"),ease:"enter",from:0.0)
                tween(next,"filters.searchBlur.inputRadius",to:0.0,duration:SearchDesign.duration("standard"),ease:"enter",from:SearchDesign.blur("soft"))
                if let old {
                    outgoing = old
                    tween(old,"position.y",to:SearchDesign.control("labelOutY"),duration:SearchDesign.duration("fast"))
                    tween(old,"opacity",to:0.0,duration:SearchDesign.duration("fast"))
                    tween(old,"filters.searchBlur.inputRadius",to:SearchDesign.blur("soft"),duration:SearchDesign.duration("fast"))
                    let work = DispatchWorkItem { [weak self,weak old] in old?.removeFromSuperlayer(); self?.outgoing = nil }
                    retirement = work; DispatchQueue.main.asyncAfter(deadline:.now()+SearchDesign.duration("fast"),execute:work)
                }
            } else { old?.removeFromSuperlayer() }
        }
        let ink = owner.color(copied && !pending ? "success" : "foreground").cgColor
        if initialized && root.backgroundColor != ink { tween(root,"backgroundColor",to:ink,duration:SearchDesign.duration("fast")) }
        else { withoutActions { root.backgroundColor = ink } }
        withoutActions { spinner.strokeColor = owner.color("background").cgColor }
        if !initialized { withoutActions { labelHost.opacity = pending ? 0 : 1; spinner.opacity = 0 } }
        if working != pending {
            working = pending; stopSpinner?.cancel()
            tween(labelHost,"opacity",to:pending ? 0.0 : 1.0,duration:SearchDesign.duration("fast"))
            tween(spinner,"opacity",to:pending ? 1.0 : 0.0,duration:SearchDesign.duration("fast"),ease:pending ? "enter" : "standard")
            if pending && !SearchDesign.reduced {
                searchScaleSpring(spinner,to:1,spring:"snappy",initial:SearchDesign.control("loaderInScale"))
                tween(spinner,"filters.searchBlur.inputRadius",to:0.0,duration:SearchDesign.duration("fast"),ease:"enter")
            } else {
                tween(spinner,"transform.scale",to:SearchDesign.control("loaderOutScale"),duration:SearchDesign.duration("fast"))
                tween(spinner,"filters.searchBlur.inputRadius",to:SearchDesign.blur("subtle"),duration:SearchDesign.duration("fast"))
                let work = DispatchWorkItem { [weak self] in guard self?.working == false else { return }; self?.spinner.removeAnimation(forKey:"working") }
                stopSpinner = work; DispatchQueue.main.asyncAfter(deadline:.now()+SearchDesign.duration("fast"),execute:work)
            }
        }
        if pending && !SearchDesign.reduced {
            if spinner.animation(forKey:"working") == nil {
                let a = CABasicAnimation(keyPath:"transform.rotation.z"); a.fromValue = 0; a.toValue = 2*Double.pi
                a.duration = SearchDesign.interaction("spinner"); a.repeatCount = .infinity; spinner.add(a,forKey:"working")
            }
        }
        initialized = true; show(visible,buttonHovered:buttonHovered)
    }
    func show(_ visible:Bool, buttonHovered:Bool) {
        let opacity:Float = visible ? (buttonHovered ? 0.91 : 1) : 0
        if root.opacity != opacity { tween(root,"opacity",to:opacity,duration:SearchDesign.duration("fast")) }
    }
    func reduceMotion() {
        retirement?.cancel(); outgoing?.removeFromSuperlayer(); outgoing = nil
        widthMotion.set(targetWidth,spring:"morph",immediate:true)
        for layer in [root,labelHost,spinner,phase].compactMap({ $0 }) { layer.removeAllAnimations() }
        withoutActions {
            labelHost.opacity = working ? 0 : 1; spinner.opacity = working ? 1 : 0
            phase?.opacity = 1; phase?.position = .zero; phase?.setValue(0,forKeyPath:"filters.searchBlur.inputRadius")
            spinner.transform = CATransform3DIdentity; spinner.setValue(0,forKeyPath:"filters.searchBlur.inputRadius")
        }
    }
}
