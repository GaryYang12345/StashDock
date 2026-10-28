import Foundation
import Security

@objc protocol SafariCaptureProtocol {
    func request(_ packet: Data, reply: @escaping (Data) -> Void)
}

enum SafariCaptureContract {
    static let limit = 1_000_000
    static let service = "app.stashdock.desktop.SafariCapture"
    static let caller = "app.stashdock.desktop.SafariExtension"
    static let paths: Set<String> = ["/health", "/setup", "/tags", "/capture/lookup", "/capture"]

    static func peer(_ identifier: String) throws -> String {
        var code: SecCode?, staticCode: SecStaticCode?, info: CFDictionary?
        guard SecCodeCopySelf([], &code) == errSecSuccess, let code,
              SecCodeCopyStaticCode(code, [], &staticCode) == errSecSuccess, let staticCode,
              SecCodeCopySigningInformation(staticCode, SecCSFlags(rawValue: kSecCSSigningInformation), &info) == errSecSuccess,
              let team = (info as? [String: Any])?[kSecCodeInfoTeamIdentifier as String] as? String,
              team.range(of: "^[A-Z0-9]{10}$", options: .regularExpression) != nil else {
            throw NSError(domain: "StashDockSigning", code: 1)
        }
        return "anchor apple generic and certificate leaf[subject.OU] = \"\(team)\" and identifier \"\(identifier)\""
    }

    static func error(_ text: String) -> Data {
        (try? JSONSerialization.data(withJSONObject: ["ok": false, "error": text])) ?? Data()
    }
}

// Both wire generations converge here; old already-open popup requests do not
// keep an HTTP backend alive. No caller-controlled port/path reaches a socket.
struct SafariNativeRequest {
    let packet: Data
    let legacy: Bool
    init?(_ message: [String: Any], version: String) {
        var path: String, body: String?
        if Set(message.keys).isSubset(of: ["path", "body"]), let value = message["path"] as? String {
            path = value; legacy = false
            if message["body"] != nil && !(message["body"] is String) { return nil }
            body = message["body"] as? String
        } else {
            guard Set(message.keys) == Set(["method", "path", "body", "port"]),
                  let method = message["method"] as? String, let value = message["path"] as? String,
                  let content = message["body"] as? String, let port = message["port"] as? Int,
                  [17863, 17864].contains(port), value.hasPrefix("/v1/") else { return nil }
            path = String(value.dropFirst(3)); body = content; legacy = true
            guard (method == "GET" && ["/health", "/tags"].contains(path)) ||
                  (method == "POST" && ["/setup", "/capture", "/tags", "/capture/lookup"].contains(path)) else { return nil }
        }
        guard SafariCaptureContract.paths.contains(path), (body?.utf8.count ?? 0) <= SafariCaptureContract.limit else { return nil }
        if path == "/setup" {
            let data = try? JSONSerialization.data(withJSONObject: ["browser": "safari", "extensionId": SafariCaptureContract.caller, "version": version])
            body = data.flatMap { String(data: $0, encoding: .utf8) }
        }
        var object: [String: Any] = ["path": path]
        if let body { object["body"] = body }
        guard let data = try? JSONSerialization.data(withJSONObject: object), data.count <= SafariCaptureContract.limit else { return nil }
        packet = data
    }
}
