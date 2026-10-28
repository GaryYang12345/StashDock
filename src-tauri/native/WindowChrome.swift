// A unified native titlebar, not a second web toolbar. The page extends beneath
// the native chrome; the system owns traffic lights, dragging and fullscreen.
import AppKit

// NSWindow handles native titlebar gestures when the hit view opts into window
// movement. WKWebView opts out, so retain a transparent native hit region above
// it, limited to AppKit's actual titlebar inset. No web gesture or IPC loop.
@MainActor final class NativeTitlebarRegion: NSView {
    override var mouseDownCanMoveWindow: Bool { true }
}

@MainActor enum WindowChrome {
    static func install(_ window: NSWindow) {
        // Generated from Arc foundation.css, the same palette as Sidebar.
        // Resolve through the window's appearance, including System.
        let palette = try! JSONSerialization.jsonObject(with: Data(searchTokenJSON.utf8)) as! [String: Any]
        let themes = palette["themes"] as! [String: [String: Any]]
        func surface(_ theme: String) -> NSColor {
            let rgb = themes[theme]!["surface-muted"] as! [Double]
            return NSColor(srgbRed: rgb[0], green: rgb[1], blue: rgb[2], alpha: 1)
        }
        let light = surface("light"), dark = surface("dark")
        window.backgroundColor = NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? dark : light
        }
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.titlebarSeparatorStyle = .none
        if let root = window.contentView {
            let region = NativeTitlebarRegion()
            region.setAccessibilityElement(false)
            root.addSubview(region)
            region.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                region.leadingAnchor.constraint(equalTo: root.leadingAnchor),
                region.trailingAnchor.constraint(equalTo: root.trailingAnchor),
                region.topAnchor.constraint(equalTo: root.topAnchor),
                region.bottomAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor)
            ])
            root.layoutSubtreeIfNeeded()
        }
    }
}

@_cdecl("stashdock_window_chrome_install") @MainActor
func stashdockWindowChromeInstall(_ pointer: UnsafeMutableRawPointer) {
    WindowChrome.install(Unmanaged<NSWindow>.fromOpaque(pointer).takeUnretainedValue())
}
