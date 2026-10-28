import Foundation
import Darwin

// Private signed XPC, delegating to the shared Rust helper. No socket or window.
private final class Lifetime {
    private let lock = NSLock()
    private var connections = 0
    private var requests = 0
    private var generation = 0
    init() {
        DispatchQueue.global().asyncAfter(deadline: .now() + 5) {
            self.lock.lock(); let unused = self.generation == 0; self.lock.unlock()
            if unused { exit(EXIT_SUCCESS) }
        }
    }
    func connected() { lock.lock(); connections += 1; generation += 1; lock.unlock() }
    func disconnected() { lock.lock(); connections -= 1; scheduleExit(); lock.unlock() }
    func begin() -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard requests < 2 else { return false }
        requests += 1; generation += 1; return true
    }
    func finish() { lock.lock(); requests -= 1; scheduleExit(); lock.unlock() }
    private func scheduleExit() {
        guard connections == 0 && requests == 0 else { return }
        generation += 1; let expected = generation
        DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
            self.lock.lock()
            let idle = self.connections == 0 && self.requests == 0 && self.generation == expected
            self.lock.unlock()
            if idle { exit(EXIT_SUCCESS) }
        }
    }
}

private final class CaptureService: NSObject, SafariCaptureProtocol {
    private let lifetime: Lifetime
    private let lock = NSLock()
    private var used = false
    init(_ lifetime: Lifetime) { self.lifetime = lifetime }
    func request(_ packet: Data, reply: @escaping (Data) -> Void) {
        lock.lock(); let admitted = !used; used = true; lock.unlock()
        guard admitted, packet.count <= SafariCaptureContract.limit else {
            reply(SafariCaptureContract.error("Invalid StashDock request.")); return
        }
        guard lifetime.begin() else {
            reply(SafariCaptureContract.error("StashDock is busy. Retry in a moment.")); return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            defer { self.lifetime.finish() }
            do { reply(try Self.run(packet)) }
            catch { reply(SafariCaptureContract.error("The local save component could not complete the request. Retry.")) }
        }
    }
    private static func run(_ packet: Data) throws -> Data {
        guard let helper = Bundle.main.url(forAuxiliaryExecutable: "stashdock-browser"),
              let home = FileManager.default.homeDirectory(forUser: NSUserName()) else { throw CocoaError(.fileNoSuchFile) }
        var environment = ["HOME": home.path,
            "PATH": "/usr/bin:/bin", "TMPDIR": NSTemporaryDirectory(),
            "STASHDOCK_NATIVE_HOST_REGISTRATION": "off"]
        #if STASHDOCK_QA
        guard let home = Bundle.main.object(forInfoDictionaryKey: "StashDockQAHome") as? String,
              let root = Bundle.main.object(forInfoDictionaryKey: "StashDockQALibrary") as? String,
              home.hasPrefix("/"), root.hasPrefix("/") else { throw CocoaError(.fileReadNoPermission) }
        environment["HOME"] = home; environment["STASHDOCK_DATA_DIR"] = root
        #endif
        let process = Process(), input = Pipe(), output = Pipe()
        process.executableURL = helper
        process.arguments = ["--safari-extension", SafariCaptureContract.caller]
        process.environment = environment
        process.standardInput = input; process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        try process.run()
        let deadline = DispatchWorkItem { if process.isRunning { process.terminate() } }
        DispatchQueue.global().asyncAfter(deadline: .now() + 13, execute: deadline)
        defer {
            deadline.cancel()
            try? input.fileHandleForWriting.close(); try? output.fileHandleForReading.close()
            if process.isRunning { process.terminate() }
        }
        let size = UInt32(packet.count).littleEndian
        var framed = withUnsafeBytes(of: size) { Data($0) }; framed.append(packet)
        try input.fileHandleForWriting.write(contentsOf: framed)
        try input.fileHandleForWriting.close()
        var bytes = Data()
        while let chunk = try output.fileHandleForReading.read(upToCount: min(65536, SafariCaptureContract.limit + 5 - bytes.count)), !chunk.isEmpty {
            bytes.append(chunk)
            guard bytes.count <= SafariCaptureContract.limit + 4 else { throw CocoaError(.fileReadTooLarge) }
        }
        process.waitUntilExit()
        guard process.terminationStatus == 0, bytes.count >= 4 else { throw CocoaError(.fileReadCorruptFile) }
        let length = bytes.prefix(4).enumerated().reduce(UInt32(0)) { $0 | UInt32($1.element) << (8 * $1.offset) }
        guard length == bytes.count - 4 else { throw CocoaError(.fileReadCorruptFile) }
        return Data(bytes.dropFirst(4))
    }
}

private final class ListenerDelegate: NSObject, NSXPCListenerDelegate {
    let lifetime = Lifetime()
    func listener(_ listener: NSXPCListener, shouldAcceptNewConnection connection: NSXPCConnection) -> Bool {
        guard connection.effectiveUserIdentifier == getuid(),
              let requirement = try? SafariCaptureContract.peer(SafariCaptureContract.caller) else { return false }
        // A serviceListener cannot use the listener-level requirement API.
        // Set the requirement on each suspended connection before resuming it.
        connection.setCodeSigningRequirement(requirement)
        lifetime.connected()
        connection.exportedInterface = NSXPCInterface(with: SafariCaptureProtocol.self)
        connection.exportedObject = CaptureService(lifetime)
        connection.invalidationHandler = { self.lifetime.disconnected() }
        connection.resume(); return true
    }
}

@main enum SafariCaptureServiceMain {
    static func main() {
        signal(SIGPIPE, SIG_IGN)
        let delegate = ListenerDelegate(), listener = NSXPCListener.service()
        listener.delegate = delegate
        withExtendedLifetime(delegate) { listener.resume(); RunLoop.current.run() }
    }
}
