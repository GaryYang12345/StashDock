import Foundation

@main enum SafariCaptureTestClient {
    static func main() {
        if let path = Bundle.main.object(forInfoDictionaryKey:"StashDockQAProbe") as? String {
            let denied = (try? Data(contentsOf:URL(fileURLWithPath:path))) == nil
            print("{\"started\":true,\"sandboxDeniedOwnedLibrary\":\(denied)}")
            fflush(stdout)
        }
        while let line = readLine() {
            guard let data=line.data(using:.utf8),data.count<=SafariCaptureContract.limit,
                  let message=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],
                  let request=SafariNativeRequest(message,version:"0.4.22") else {
                print("{\"ok\":false,\"error\":\"Invalid test packet\"}");fflush(stdout);continue
            }
            let complete=DispatchSemaphore(value:0)
            var response=SafariCaptureContract.error("Test client timed out")
            SafariCaptureConnection.send(request.packet) { value in response=value;complete.signal() }
            _=complete.wait(timeout:.now()+15)
            print(String(data:response,encoding:.utf8) ?? "{}");fflush(stdout)
        }
    }
}
