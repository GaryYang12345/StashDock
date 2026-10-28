import SafariServices
import Foundation

// Safari owns the caller. XPC also binds both peers to the same signing team.
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private static let lock = NSLock()
    private static var active = 0
    func beginRequest(with context: NSExtensionContext) {
        guard let input = context.inputItems.first as? NSExtensionItem,
              let message = input.userInfo?[SFExtensionMessageKey] as? [String: Any],
              let request = SafariNativeRequest(message, version: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0") else {
            Self.reply(context, value: ["ok": false, "error": "Invalid StashDock request."]); return
        }
        Self.lock.lock(); let admitted = Self.active < 2
        if admitted { Self.active += 1 }; Self.lock.unlock()
        guard admitted else {
            Self.reply(context, value: ["ok": false, "error": "StashDock is busy. Retry in a moment."]); return
        }
        SafariCaptureConnection.send(request.packet) { bytes in
            Self.lock.lock(); Self.active -= 1; Self.lock.unlock()
            let result = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any]
                ?? ["ok": false, "error": "The local save component returned an invalid response."]
            if request.legacy {
                let success = result["ok"] as? Bool == true
                let object = success ? result["value"] ?? [:] : ["error": result["error"] ?? "The page could not be saved. Retry."]
                let body = (try? JSONSerialization.data(withJSONObject: object)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
                Self.reply(context, value: ["status": success ? 200 : 503, "body": body])
            } else { Self.reply(context, value: result) }
        }
    }
    private static func reply(_ context: NSExtensionContext, value: [String: Any]) {
        let response = NSExtensionItem(); response.userInfo = [SFExtensionMessageKey: value]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}

final class SafariCaptureConnection {
    private let connection: NSXPCConnection
    private let lock = NSLock()
    private var completion: ((Data) -> Void)?
    private var deadline: DispatchWorkItem?
    private init(_ completion: @escaping (Data) -> Void) {
        connection = NSXPCConnection(serviceName: SafariCaptureContract.service)
        self.completion = completion
    }
    static func send(_ packet: Data, completion: @escaping (Data) -> Void) {
        let owner = SafariCaptureConnection(completion)
        do {
            owner.connection.setCodeSigningRequirement(try SafariCaptureContract.peer(SafariCaptureContract.service))
            owner.connection.remoteObjectInterface = NSXPCInterface(with: SafariCaptureProtocol.self)
            owner.connection.interruptionHandler = { owner.finish(SafariCaptureContract.error("The local save component disconnected. Retry.")) }
            owner.connection.invalidationHandler = { owner.finish(SafariCaptureContract.error("The local save component is unavailable. Try again.")) }
            let timeout = DispatchWorkItem { owner.finish(SafariCaptureContract.error("The local save request timed out. Retry.")) }
            owner.deadline = timeout
            DispatchQueue.global().asyncAfter(deadline: .now() + 13, execute: timeout)
            owner.connection.resume()
            let proxy = owner.connection.remoteObjectProxyWithErrorHandler { _ in
                owner.finish(SafariCaptureContract.error("The local save component is unavailable. Try again."))
            } as? SafariCaptureProtocol
            guard let proxy else { throw CocoaError(.coderInvalidValue) }
            proxy.request(packet) { owner.finish($0) }
        } catch { owner.finish(SafariCaptureContract.error("StashDock must be signed by its developer to save from Safari.")) }
    }
    private func finish(_ bytes: Data) {
        lock.lock(); let callback = completion; completion = nil
        let timer = deadline; deadline = nil; lock.unlock()
        guard let callback else { return }
        timer?.cancel()
        connection.interruptionHandler = nil; connection.invalidationHandler = nil
        connection.invalidate()
        callback(bytes.count <= SafariCaptureContract.limit ? bytes : SafariCaptureContract.error("The local save response is too large."))
    }
}
