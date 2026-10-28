import Foundation
func parse(_ input: [String: Any]) -> SafariNativeRequest? { SafariNativeRequest(input, version:"0.4.22") }
func packet(_ request: SafariNativeRequest) -> [String: Any] { try! JSONSerialization.jsonObject(with:request.packet) as! [String:Any] }
for path in ["/health","/setup","/tags","/capture/lookup","/capture"] {
    let request=parse(["path":path,"body":"{}"] )!
    precondition(!request.legacy && packet(request)["path"] as? String == path)
}
let setup=packet(parse(["path":"/setup","body":"{\"browser\":\"chrome\",\"extensionId\":\"untrusted\",\"version\":\"bad\"}"])!)
let body=try JSONSerialization.jsonObject(with:Data((setup["body"] as! String).utf8)) as! [String:String]
precondition(body == ["browser":"safari","extensionId":"app.stashdock.desktop.SafariExtension","version":"0.4.22"])
for port in [17863,17864] {
    let request=parse(["method":"POST","path":"/v1/capture","body":"{}","port":port])!
    precondition(request.legacy && packet(request)["path"] as? String == "/capture")
}
for input: [String: Any] in [
    ["path":"/items"], ["path":"//example.org"], ["path":"/capture#x"],
    ["path":"/capture","body":NSNull()], ["path":"/capture","body":true],
    ["path":"/capture","body":String(repeating:"中",count:333334)],
    ["path":"/health","sql":"SELECT 1"], ["path":"/health","host":"arbitrary"],
    ["method":"DELETE","path":"/v1/capture","body":"{}","port":17863],
    ["method":"POST","path":"/v1/capture","body":"{}","port":17865],
] { precondition(parse(input)==nil) }
for raw in ["17864","17864.5","true","\"17864\""] {
    let input=try JSONSerialization.jsonObject(with:Data("{\"port\":\(raw),\"method\":\"GET\",\"path\":\"/v1/health\",\"body\":\"\"}".utf8)) as! [String:Any]
    precondition((parse(input) != nil) == (raw == "17864"))
}
print("Safari native request: bounded canonical packets, trusted identity and old-popup compatibility passed")
