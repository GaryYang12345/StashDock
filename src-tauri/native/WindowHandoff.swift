// Freeze only our WebKit content. A real titled AppKit presentation window
// owns its chrome/shadow for the entire gesture; never bitmap-cache a titlebar.
// No screen capture, private API, renderer handshake or real-WebView resizing.
import AppKit
import WebKit
import QuartzCore
import os

@MainActor enum HandoffDesign {
    static let data = try! JSONSerialization.jsonObject(with:Data(handoffTokenJSON.utf8)) as! [String:Any]
    static func value(_ key:String) -> Double { data[key] as! Double }
    static func ease(_ key:String) -> CAMediaTimingFunction {
        let p = data[key] as! [Double]
        return CAMediaTimingFunction(controlPoints:Float(p[0]),Float(p[1]),Float(p[2]),Float(p[3]))
    }
}

@MainActor final class HandoffImageWindow: NSWindow {
    static func overlaysChrome(_ window: NSWindow) -> Bool {
        window.styleMask.contains(.fullSizeContentView) && window.titlebarAppearsTransparent
    }
    let picture = NSView()
    private let presentsPanel: Bool
    override var canBecomeKey: Bool { presentsPanel }
    override var canBecomeMain: Bool { presentsPanel }
    init(image:NSImage, frame:NSRect, template:NSWindow? = nil) {
        presentsPanel = template != nil
        let style = template?.styleMask ?? [.borderless]
        super.init(contentRect:NSWindow.contentRect(forFrameRect:frame,styleMask:style),styleMask:style,backing:.buffered,defer:false)
        isReleasedWhenClosed = false; ignoresMouseEvents = true
        isExcludedFromWindowsMenu = true; hidesOnDeactivate = false
        tabbingMode = .disallowed; isRestorable = false
        animationBehavior = .none
        if let template {
            isOpaque = template.isOpaque; backgroundColor = template.backgroundColor
            appearance = template.appearance; hasShadow = template.hasShadow
            title = template.title; titleVisibility = template.titleVisibility
            titlebarAppearsTransparent = template.titlebarAppearsTransparent
            titlebarSeparatorStyle = template.titlebarSeparatorStyle
            toolbarStyle = template.toolbarStyle
            level = .normal
            collectionBehavior = [.moveToActiveSpace,.ignoresCycle,.transient]
        } else {
            isOpaque = false; backgroundColor = .clear; hasShadow = false
            level = .floating
            collectionBehavior = [.canJoinAllSpaces,.fullScreenAuxiliary,.ignoresCycle,.transient]
        }
        setFrame(frame,display:false)
        // Only frozen page content scales. AppKit keeps real traffic lights,
        // titlebar metrics, corner clipping and window shadow throughout.
        let root = NSView(frame:contentView!.bounds)
        contentView = root
        root.addSubview(picture); picture.translatesAutoresizingMaskIntoConstraints = false
        if Self.overlaysChrome(self) {
            NSLayoutConstraint.activate([
                picture.leadingAnchor.constraint(equalTo:root.leadingAnchor),
                picture.trailingAnchor.constraint(equalTo:root.trailingAnchor),
                picture.topAnchor.constraint(equalTo:root.topAnchor),
                picture.bottomAnchor.constraint(equalTo:root.bottomAnchor)
            ])
        } else {
            let safe = root.safeAreaLayoutGuide
            NSLayoutConstraint.activate([
                picture.leadingAnchor.constraint(equalTo:safe.leadingAnchor),
                picture.trailingAnchor.constraint(equalTo:safe.trailingAnchor),
                picture.topAnchor.constraint(equalTo:safe.topAnchor),
                picture.bottomAnchor.constraint(equalTo:safe.bottomAnchor)
            ])
        }
        picture.wantsLayer = true; picture.layerContentsRedrawPolicy = .never
        picture.layer?.contents = image.cgImage(forProposedRect:nil,context:nil,hints:nil)
        picture.layer?.contentsGravity = .resize
        root.layoutSubtreeIfNeeded()
    }
    func stop() {
        // The proxy owns native property animations. Replace them at the live
        // AppKit frame/alpha before reversing; removing a view-layer animation
        // would not cancel a window-server frame animation.
        let frame = self.frame, alpha = alphaValue
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0
            animator().setFrame(frame,display:true); animator().alphaValue = alpha
        }
    }
}

@MainActor final class WindowHandoff: NSObject {
    private static let log = Logger(subsystem:"app.stashdock.desktop",category:"WindowHandoff")
    private func trace(_ phase:String) {
        guard let panel else { return }
        let web = panel.contentView.flatMap { Self.webView(in:$0) }
        let geometry = "phase=\(phase) token=\(token) expand=\(expand) real=\(panel.frame) style=\(panel.styleMask.rawValue) layout=\(panel.contentLayoutRect) content=\(panel.contentView?.bounds ?? .zero) web=\(web?.bounds ?? .zero) webFrame=\(web?.frame ?? .zero) webSafe=\(web?.safeAreaRect ?? .zero) image=\(panelImage?.size ?? .zero) copy=\(panelCopy?.frame ?? .zero) copyLayout=\(panelCopy?.contentLayoutRect ?? .zero) copyContent=\(panelCopy?.picture.bounds ?? .zero) copyLayer=\(panelCopy?.picture.layer?.bounds ?? .zero) copyPresentation=\(panelCopy?.picture.layer?.presentation()?.bounds ?? .zero)"
        Self.log.debug("\(geometry,privacy:.public)")
    }
    typealias Reply = @convention(c) (UInt64, Bool) -> Void
    private(set) var token: UInt64 = 0
    private(set) var preparing = false
    private(set) var active = false
    private var panel: NSWindow?, folder: NSWindow?
    private var panelImage: NSImage?, folderImage: NSImage?
    private var panelCopy: HandoffImageWindow?, folderCopy: HandoffImageWindow?
    private var waits: [DispatchWorkItem] = []
    private var animationsRemaining = 0
    private var originalInput: (Bool,Bool) = (false,false)
    private var originalAlpha: (CGFloat,CGFloat) = (1,1)
    private var expand = false
    private var ready: Reply?, completed: Reply?

    override init() {
        super.init()
        NotificationCenter.default.addObserver(self,selector:#selector(environmentChanged),name:NSApplication.didChangeScreenParametersNotification,object:nil)
        NotificationCenter.default.addObserver(self,selector:#selector(applicationEnding),name:NSApplication.willTerminateNotification,object:nil)
        NSWorkspace.shared.notificationCenter.addObserver(self,selector:#selector(environmentChanged),name:NSWorkspace.willSleepNotification,object:nil)
        NSWorkspace.shared.notificationCenter.addObserver(self,selector:#selector(motionChanged),name:NSWorkspace.accessibilityDisplayOptionsDidChangeNotification,object:nil)
    }
    @objc private func applicationEnding() { cancel() }
    @objc private func motionChanged() { if !Self.enabled { environmentChanged() } }
    @objc private func environmentChanged() {
        if preparing { preparing = false; ready?(token,false) }
        else if active { let reply = completed, token = self.token; cancelPresentation(); reply?(token,true) }
    }

    static var enabled: Bool { !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion }
    private static func webView(in view:NSView) -> WKWebView? {
        if let web = view as? WKWebView { return web }
        return view.subviews.lazy.compactMap { webView(in:$0) }.first
    }
    private static func ownImage(_ view:NSView) -> NSImage? {
        guard view.bounds.width > 0, view.bounds.height > 0,
              let rep = view.bitmapImageRepForCachingDisplay(in:view.bounds) else { return nil }
        view.layoutSubtreeIfNeeded(); view.displayIfNeeded()
        view.cacheDisplay(in:view.bounds,to:rep)
        let image = NSImage(size:view.bounds.size); image.addRepresentation(rep); return image
    }
    func prepare(panel:NSWindow, folder:NSWindow, expand:Bool, token:UInt64, ready:Reply, completed:Reply) -> Bool {
        guard Self.enabled, !panel.styleMask.contains(.fullScreen),
              panel.toolbar == nil, panel.titlebarAccessoryViewControllers.isEmpty,
              let frameView = panel.contentView?.superview,
              let web = Self.webView(in:frameView),
              panel.frame.width > 0, panel.frame.height > 0,
              panel.frame.width*panel.frame.height*pow(panel.backingScaleFactor,2) <= 16_000_000 else { return false }
        waits.forEach { $0.cancel() }; waits.removeAll()
        self.token = token; self.expand = expand; self.ready = ready; self.completed = completed
        preparing = true
        if active, self.panel === panel, self.folder === folder, panelImage != nil, folderImage != nil {
            panelCopy?.stop(); folderCopy?.stop()
            // Reversal uses the existing copies at their live positions, never
            // exposes a real source, and needs no second asynchronous snapshot.
            DispatchQueue.main.async { [weak self] in
                guard let self, self.token == token, self.preparing else { return }
                self.preparing = false; self.ready?(token,true)
            }
            return true
        }
        cancelPresentation()
        self.panel = panel; self.folder = folder
        originalInput = (panel.ignoresMouseEvents,folder.ignoresMouseEvents)
        originalAlpha = (panel.alphaValue,folder.alphaValue)
        // Tao holds its event-handler lock while delivering menu commands.
        // cacheDisplay may invoke the native view's draw callback. Leave that
        // stack before drawing, otherwise it re-enters the same lock.
        DispatchQueue.main.async { [weak self] in
            guard let self, self.token == token, self.preparing else { return }
            autoreleasepool { self.capture(panel:panel,folder:folder,frameView:frameView,web:web,token:token) }
        }
        return true
    }
    private func capture(panel:NSWindow,folder:NSWindow,frameView:NSView,web:WKWebView,token:UInt64) {
        guard let folderView = folder.contentView,
              let folderImage = Self.ownImage(folderView) else { preparing = false; ready?(token,false); return }
        let size = frameView.bounds.size
        let configuration = WKSnapshotConfiguration(); configuration.afterScreenUpdates = false
        // WK's software snapshot starts at page origin. Opaque chrome insets
        // the viewport; transparent FullSizeContentView exposes the whole page
        // beneath native controls, although NSView.safeAreaRect still excludes
        // their row. Snapshot and presentation must use the same layout policy.
        let overlaysChrome = HandoffImageWindow.overlaysChrome(panel)
        let pageSize = overlaysChrome ? web.bounds.size : web.safeAreaRect.size
        guard pageSize.width > 0, pageSize.height > 0 else { preparing = false; ready?(token,false); return }
        configuration.rect = NSRect(origin:web.bounds.origin,size:pageSize)
        web.takeSnapshot(with:configuration) { [weak self] image,error in
            guard let self, self.token == token, self.preparing else { return }
            autoreleasepool {
            self.preparing = false
            guard error == nil, let image else { self.ready?(token,false); return }
            guard panel.frame.size == size,
                  HandoffImageWindow.overlaysChrome(panel) == overlaysChrome,
                  (overlaysChrome ? web.bounds.size : web.safeAreaRect.size) == pageSize,
                  image.size == pageSize else { self.ready?(token,false); return }
            // WKWebView supplies page pixels only. Native window chrome is
            // composed live by AppKit on the presentation window, never cached.
            self.panelImage = image
            self.folderImage = folderImage
            self.trace("snapshot")
            self.ready?(token,true)
            }
        }
        let timeout = DispatchWorkItem { [weak self] in
            guard let self, self.token == token, self.preparing else { return }
            self.preparing = false; self.ready?(token,false)
        }
        waits.append(timeout); DispatchQueue.main.asyncAfter(deadline:.now()+0.25,execute:timeout)
    }
    func stage(_ token:UInt64) -> Bool {
        guard self.token == token, !preparing, Self.enabled,
              let panel, let folder, let panelImage, let folderImage else { return false }
        waits.forEach { $0.cancel() }; waits.removeAll()
        if !active {
            let p = panel.frame, f = folder.frame
            let small = Self.seed(panel:p,folder:f,titlebarHeight:Self.reservedChromeHeight(panel))
            panelCopy = HandoffImageWindow(image:panelImage,frame:expand ? small : p,template:panel)
            folderCopy = HandoffImageWindow(image:folderImage,frame:expand ? f : Self.scaled(f,HandoffDesign.value("collapseFolderScale")))
            panelCopy?.alphaValue = expand ? 0 : originalAlpha.0
            folderCopy?.alphaValue = expand ? originalAlpha.1 : 0
        }
        guard let panelCopy, let folderCopy else { return false }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        panelCopy.order(.above,relativeTo:panel.windowNumber); folderCopy.order(.above,relativeTo:folder.windowNumber)
        panel.alphaValue = 0; folder.alphaValue = 0
        panel.ignoresMouseEvents = true; folder.ignoresMouseEvents = true
        CATransaction.commit()
        active = true
        trace("stage")
        return true
    }
    static func reservedChromeHeight(_ window:NSWindow) -> CGFloat {
        HandoffImageWindow.overlaysChrome(window) ? 0 : window.frame.height-window.contentLayoutRect.height
    }
    static func seed(panel:NSRect,folder:NSRect,titlebarHeight:CGFloat = 0) -> NSRect {
        let width = folder.width*HandoffDesign.value("seed")
        // Native chrome retains its standard height. Preserve the page's
        // aspect ratio throughout, rather than squeezing it underneath a
        // fixed-height titlebar inside a Windows whole-frame seed rectangle.
        let height = width*(panel.height-titlebarHeight)/panel.width+titlebarHeight
        return NSRect(x:folder.midX-width/2,y:folder.midY-height/2,width:width,height:height)
    }
    static func scaled(_ rect:NSRect,_ scale:Double) -> NSRect {
        NSRect(x:rect.midX-rect.width*scale/2,y:rect.midY-rect.height*scale/2,width:rect.width*scale,height:rect.height*scale)
    }
    private func animate(_ window:NSWindow, duration:Double, ease:CAMediaTimingFunction?, frame:NSRect? = nil, alpha:CGFloat? = nil) {
        let token = self.token
        NSAnimationContext.runAnimationGroup { context in
            context.duration = duration; context.timingFunction = ease
            if let frame { window.animator().setFrame(frame,display:true) }
            if let alpha { window.animator().alphaValue = alpha }
        } completionHandler: { [weak self] in
            guard let self, self.token == token, self.active else { return }
            self.animationsRemaining -= 1
            if self.animationsRemaining == 0 { self.finish(token) }
        }
    }
    private func after(_ delay:Double, _ work:@escaping @MainActor () -> Void) {
        let token = self.token
        let item = DispatchWorkItem { [weak self] in guard let self, self.token == token, self.active else { return }; work() }
        waits.append(item); DispatchQueue.main.asyncAfter(deadline:.now()+delay,execute:item)
    }
    func play(_ token:UInt64) {
        // Leave Tao's event-delivery stack before changing native key/main
        // window status (its delegate callbacks must not re-enter the lock).
        DispatchQueue.main.async { [weak self] in
            guard let self, self.token == token, self.active else { return }
            self.playPrepared(token)
        }
    }
    private func playPrepared(_ token:UInt64) {
        guard self.token == token, active, let panel, let folder, let panelCopy, let folderCopy else { return }
        let enter = HandoffDesign.ease("enter"), inOut = HandoffDesign.ease("inOut")
        let linear = CAMediaTimingFunction(name:.linear)
        let duration = HandoffDesign.value(expand ? "expand" : "collapse")
        // This transient real AppKit window owns native chrome from the first
        // visible frame. It takes native key/main appearance while presenting;
        // all keyboard commands still route through the same application menu.
        // The library NSWindow and its WebView retain their final bounds.
        panelCopy.makeKeyAndOrderFront(nil); panelCopy.makeMain()
        // Count all tracks before starting any: AppKit may complete an
        // unchanged property immediately, including a reversed zero-distance
        // track. Delayed tracks are included in this same completion barrier.
        animationsRemaining = 4
        if expand {
            animate(panelCopy,duration:duration,ease:enter,frame:panel.frame)
            animate(panelCopy,duration:duration*HandoffDesign.value("expandPanelFade"),ease:enter,alpha:originalAlpha.0)
            animate(folderCopy,duration:duration,ease:enter,frame:Self.scaled(folder.frame,1+HandoffDesign.value("grow")))
            animate(folderCopy,duration:duration*HandoffDesign.value("expandFolderFade"),ease:linear,alpha:0)
        } else {
            animate(panelCopy,duration:duration,ease:inOut,frame:Self.seed(panel:panel.frame,folder:folder.frame,titlebarHeight:Self.reservedChromeHeight(panel)))
            let fadeStart = HandoffDesign.value("collapsePanelFadeStart"), fadeEnd = HandoffDesign.value("collapsePanelFadeEnd")
            let moveStart = HandoffDesign.value("collapseFolderMoveStart")
            let folderStart = HandoffDesign.value("collapseFolderFadeStart"), folderEnd = HandoffDesign.value("collapseFolderFadeEnd")
            after(duration*fadeStart) { [weak self] in self?.animate(panelCopy,duration:duration*(fadeEnd-fadeStart),ease:linear,alpha:0) }
            after(duration*moveStart) { [weak self] in self?.animate(folderCopy,duration:duration*(1-moveStart),ease:enter,frame:folder.frame) }
            after(duration*folderStart) { [weak self] in self?.animate(folderCopy,duration:duration*(folderEnd-folderStart),ease:enter,alpha:self?.originalAlpha.1 ?? 1) }
        }
    }
    private func finish(_ token:UInt64) {
        guard self.token == token, active else { return }
        let reply = completed
        trace("finish")
        cancelPresentation(); reply?(token,true)
    }
    private func cancelPresentation() {
        waits.forEach { $0.cancel() }; waits.removeAll()
        let wasActive = active
        let interrupted = animationsRemaining > 0
        // Stopping a native animator can itself deliver its completion. Fence
        // those callbacks before touching any window or restoring live input.
        active = false; animationsRemaining = 0
        if interrupted { for window in [panelCopy,folderCopy].compactMap({$0}) { window.stop() } }
        if wasActive {
            let restoreKey = NSApp.keyWindow === panelCopy
            CATransaction.begin(); CATransaction.setDisableActions(true)
            panel?.alphaValue = originalAlpha.0; folder?.alphaValue = originalAlpha.1
            panel?.ignoresMouseEvents = originalInput.0; folder?.ignoresMouseEvents = originalInput.1
            // Restore only the still-visible policy destination, and only if
            // we still own key focus. Never steal it back from another app.
            if restoreKey, NSApp.isActive, let destination = expand ? panel : folder, destination.isVisible {
                destination.order(.above,relativeTo:panelCopy?.windowNumber ?? 0)
                destination.makeKey()
                if destination.canBecomeMain { destination.makeMain() }
            }
            CATransaction.commit()
        }
        for window in [panelCopy,folderCopy].compactMap({$0}) { window.orderOut(nil); window.close() }
        panelCopy = nil; folderCopy = nil; panelImage = nil; folderImage = nil
    }
    func cancel() {
        token &+= 1; preparing = false; cancelPresentation()
        panel = nil; folder = nil; ready = nil; completed = nil
    }
}
@MainActor private let handoffOwner = WindowHandoff()
@_cdecl("stashdock_handoff_prepare") @MainActor func handoffPrepare(_ panel:UnsafeMutableRawPointer, _ folder:UnsafeMutableRawPointer, _ expand:Bool, _ token:UInt64, _ ready:WindowHandoff.Reply, _ completed:WindowHandoff.Reply) -> Bool {
    handoffOwner.prepare(panel:Unmanaged<NSWindow>.fromOpaque(panel).takeUnretainedValue(),folder:Unmanaged<NSWindow>.fromOpaque(folder).takeUnretainedValue(),expand:expand,token:token,ready:ready,completed:completed)
}
@_cdecl("stashdock_handoff_stage") @MainActor func handoffStage(_ token:UInt64) -> Bool { handoffOwner.stage(token) }
@_cdecl("stashdock_handoff_play") @MainActor func handoffPlay(_ token:UInt64) { handoffOwner.play(token) }
@_cdecl("stashdock_handoff_cancel") @MainActor func handoffCancel() { handoffOwner.cancel() }
