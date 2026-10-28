// Isolated AppKit/WebKit behavior checks; never opens or mutates a library.
import { readFileSync,writeFileSync,mkdtempSync,rmSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
if(process.platform!=='darwin') throw Error('Verify native handoff on macOS.');
const scratch=mkdtempSync(join(tmpdir(),'stashdock-handoff-'));
const native=resolve(import.meta.dirname,'../src-tauri/native/WindowHandoff.swift');
const tokens=resolve(import.meta.dirname,'../src-tauri/native/WindowHandoffTokens.generated.swift');
function run(command,args) {const r=spawnSync(command,args,{encoding:'utf8',timeout:60000});if(r.status!==0)throw Error(r.stdout+r.stderr);return r.stdout;}
const fixture=String.raw`
private func check(_ value:@autoclosure ()->Bool,_ message:String,line:Int = #line) {
 if !value() { FileHandle.standardError.write(Data("Check failed at \(line): \(message)\n".utf8));exit(1) }
}
@MainActor private enum Checks {
 static let owner = WindowHandoff()
 static var replies:[(UInt64,Bool)] = [], completions:[UInt64] = []
 static var deliveringIntent = false
 static var retired:[WeakHandoffWindow] = []
 static func ready(_ token:UInt64,_ ok:Bool) { replies.append((token,ok)) }
 static func done(_ token:UInt64,_ ok:Bool) { completions.append(token) }
 static func pump(_ seconds:Double) { RunLoop.main.run(until:Date().addingTimeInterval(seconds)) }
 static func wait(_ condition:()->Bool) { let end=Date().addingTimeInterval(2);while !condition() && Date()<end {pump(0.01)};check(condition(),"bounded response") }
}
@MainActor private final class WeakHandoffWindow {
 weak var value:NSWindow?
 init(_ value:NSWindow) { self.value=value }
}
// Tao's draw callback re-enters its event lock. A synchronous capture during
// intent delivery deadlocked the first packaged build; keep this boundary real.
@MainActor private final class IntentGuardView:NSView {
 override func draw(_ dirtyRect:NSRect) {
  check(!Checks.deliveringIntent,"snapshot must leave the event-delivery stack before native drawing")
  NSColor.windowBackgroundColor.setFill();dirtyRect.fill()
 }
}
extension WindowHandoff {
 fileprivate var checkedCopies:[HandoffImageWindow] { [panelCopy,folderCopy].compactMap{$0} }
 fileprivate var checkedImages:[NSImage] { [panelImage,folderImage].compactMap{$0} }
 fileprivate static func checkBackingScale(_ scale:Int) {
  let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:100*scale,pixelsHigh:100*scale,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
  rep.size=NSSize(width:100,height:100)
  let image=NSImage(size:rep.size);image.addRepresentation(rep)
  let copy=HandoffImageWindow(image:image,frame:NSRect(x:-18000,y:-18000,width:100,height:100))
  let bitmap=copy.picture.layer!.contents as! CGImage
  check(bitmap.width==100*scale && bitmap.height==100*scale,"1x/2x original content bitmap is retained at full backing resolution")
  copy.setFrame(NSRect(x:-18000,y:-18000,width:50,height:50),display:true)
  check((copy.picture.layer!.contents as! CGImage).width==100*scale,"native window resize never rerasterizes the content bitmap")
  copy.close()
 }

}
@main private struct HandoffChecks {
 @MainActor static func main() {
  NSApplication.shared.setActivationPolicy(.prohibited);NSApplication.shared.finishLaunching()
  WindowHandoff.checkBackingScale(1);WindowHandoff.checkBackingScale(2)
  let p=NSRect(x:-18000,y:-18000,width:1180,height:788), f=NSRect(x:-17500,y:-17600,width:144,height:144)
  let unified=CommandLine.arguments.last=="unified"
  let fullSize=CommandLine.arguments.last=="fullsize" || unified
  var style:NSWindow.StyleMask = [.titled,.closable,.miniaturizable,.resizable]
  if fullSize {style.insert(.fullSizeContentView)}
  let panel=NSWindow(contentRect:NSRect(x:p.minX,y:p.minY,width:1180,height:760),styleMask:style,backing:.buffered,defer:false)
  panel.isReleasedWhenClosed=false
  panel.animationBehavior = .none
  let host=IntentGuardView(frame:NSRect(x:0,y:0,width:1180,height:760))
  let web=WKWebView(frame:host.bounds);host.addSubview(web);panel.contentView=host
  if unified {
   let before=panel.contentLayoutRect
   WindowChrome.install(panel)
   check(panel.contentLayoutRect==before,"unifying the background never moves or resizes the page safe area")
   let region=host.subviews.compactMap{$0 as? NativeTitlebarRegion}.first!
   check(region.mouseDownCanMoveWindow && region.frame.height==panel.frame.height-panel.contentLayoutRect.height,"native titlebar hit region owns gestures above WebKit")
   check(region.frame.minY==panel.contentLayoutRect.maxY,"drag region follows native safe-area geometry, not CSS or a pointer polling loop")
   check(!region.frame.contains(NSPoint(x:140,y:40)),"native hit region leaves content controls alone")
   let palette=try! JSONSerialization.jsonObject(with:Data(searchTokenJSON.utf8)) as! [String:Any]
   let themes=palette["themes"] as! [String:[String:Any]]
   for (name,theme):(NSAppearance.Name,String) in [(.aqua,"light"),(.darkAqua,"dark")] {
    NSAppearance(named:name)!.performAsCurrentDrawingAppearance {
     let actual=panel.backgroundColor.usingColorSpace(.sRGB)!
     let rgb=themes[theme]!["surface-muted"] as! [Double]
     check(zip([actual.redComponent,actual.greenComponent,actual.blueComponent],rgb).allSatisfy{abs($0-$1)<0.001},"titlebar uses the exact shared sidebar surface, including explicit and system appearance")
    }
   }
  }
  panel.orderBack(nil)
  web.loadHTMLString("<html style='background:rgb(200,230,250)'><h1>Native handoff acceptance</h1><p>Long title and 中文内容</p><div style='width:300px;height:200px;background:rgb(180,80,220)'></div><div style='position:fixed;left:500px;top:0;width:100px;height:8px;background:rgb(255,0,0)'></div></html>",baseURL:nil)
  Checks.wait{ !web.isLoading };Checks.pump(0.08)
  var viewport:[String:Double]?
  web.evaluateJavaScript("({width:innerWidth,height:innerHeight})") { result,error in
   check(error==nil,"read the actual WebKit viewport")
   viewport=result as? [String:Double]
  }
  Checks.wait{viewport != nil}
  let visiblePage=unified ? web.bounds.size : web.safeAreaRect.size
  check(abs(viewport!["height"]!-visiblePage.height)<1 && abs(viewport!["width"]!-visiblePage.width)<1,"snapshot policy matches WebKit's real layout viewport, not just NSView safe-area metrics")
  let folder=NSPanel(contentRect:f,styleMask:[.borderless,.nonactivatingPanel],backing:.buffered,defer:false)
  folder.isReleasedWhenClosed=false;folder.isOpaque=false;folder.backgroundColor = .clear
  folder.animationBehavior = .none
  let view=NSView(frame:NSRect(origin:.zero,size:f.size));view.wantsLayer=true
  let artwork=CALayer();artwork.frame=NSRect(x:20,y:20,width:104,height:104);artwork.backgroundColor=NSColor.red.cgColor
  view.layer!.addSublayer(artwork);folder.contentView=view
  let actualPanel=panel.frame
  check(WindowHandoff.seed(panel:actualPanel,folder:f).midX==f.midX,"seed centre x")
  check(WindowHandoff.seed(panel:actualPanel,folder:f).midY==f.midY,"seed centre y")
  check(abs(WindowHandoff.seed(panel:actualPanel,folder:f).width/WindowHandoff.seed(panel:actualPanel,folder:f).height-actualPanel.width/actualPanel.height)<0.000001,"seed keeps panel ratio")
  let owner=Checks.owner
  func prepare(_ token:UInt64,_ expand:Bool) {
   Checks.deliveringIntent = true
   check(owner.prepare(panel:panel,folder:folder,expand:expand,token:token,ready:{ token,ok in MainActor.assumeIsolated{Checks.ready(token,ok)} },completed:{ token,ok in MainActor.assumeIsolated{Checks.done(token,ok)} }),"prepare")
   Checks.deliveringIntent = false
   Checks.wait{Checks.replies.contains{$0.0==token}}
   check(Checks.replies.last!.1,"own content snapshot succeeds, including hidden panel")
   check(owner.stage(token),"stage")
   check(owner.checkedCopies.count==2,"exactly two temporary surfaces")
   if (3...22).contains(token) { Checks.retired += owner.checkedCopies.map(WeakHandoffWindow.init) }
   check(owner.checkedCopies.allSatisfy{$0.ignoresMouseEvents},"both presentations ignore pointer input")
   let presenter=owner.checkedCopies[0]
   check(presenter.canBecomeKey && presenter.canBecomeMain && !owner.checkedCopies[1].canBecomeKey,"native panel appearance owns temporary key/main status; folder copy never takes focus")
   check(presenter.styleMask==panel.styleMask && presenter.animationBehavior == .none,"presentation uses the same real native window style without automatic entrance animation")
   check(presenter.titlebarAppearsTransparent==panel.titlebarAppearsTransparent,"unified chrome does not change at the real-window handover")
   if unified {
    for name:NSAppearance.Name in [.aqua,.darkAqua] {
     let appearance=NSAppearance(named:name)!
     appearance.performAsCurrentDrawingAppearance {
      let actual=presenter.backgroundColor.usingColorSpace(.sRGB)!
      let expected=panel.backgroundColor.usingColorSpace(.sRGB)!
      check(abs(actual.redComponent-expected.redComponent)<0.001,"presentation retains the same dynamic sidebar surface in both themes")
     }
    }
   }
   for kind:NSWindow.ButtonType in [.closeButton,.miniaturizeButton,.zoomButton] {
    check(presenter.standardWindowButton(kind)?.window === presenter,"real native traffic light exists from the first staged frame, never appears only at handover")
   }
   let nativeBar=presenter.frame.height-presenter.picture.bounds.height
   check(abs(nativeBar-WindowHandoff.reservedChromeHeight(panel))<0.01,"page respects reserved chrome, or extends underneath native overlay controls")
   let pageSize=unified ? web.bounds.size : web.safeAreaRect.size
   let expectedContentHeight=presenter.picture.bounds.width*pageSize.height/pageSize.width
   check(abs(presenter.picture.bounds.height-expectedContentHeight)<1,"native seed preserves page aspect ratio beneath its fixed-height titlebar")
   check(owner.checkedImages[0].size==pageSize,"freeze the visible viewport, including the page underneath transparent native chrome")
   let page=NSBitmapImageRep(cgImage:owner.checkedImages[0].cgImage(forProposedRect:nil,context:nil,hints:nil)!)
   let pageScale=CGFloat(page.pixelsWide)/pageSize.width
   let top=page.colorAt(x:Int(550*pageScale),y:Int(2*pageScale))!.usingColorSpace(.deviceRGB)!
   check(top.redComponent>0.85 && top.greenComponent<0.3 && top.blueComponent<0.3,"page-origin marker remains immediately below the native titlebar in the source display gamut")
   check(owner.checkedCopies.allSatisfy{$0.picture.layerContentsRedrawPolicy == .never && $0.picture.layer?.contents != nil},"one immutable page bitmap; no per-frame view drawing")
   check(owner.checkedCopies[0].hasShadow==panel.hasShadow && !owner.checkedCopies[1].hasShadow,"system panel shadow, no folder window shadow")
   check(panel.alphaValue==0 && folder.alphaValue==0,"one visible representation")
   check(panel.ignoresMouseEvents && folder.ignoresMouseEvents,"hidden real surfaces cannot catch input")
   if expand {panel.orderBack(nil);folder.orderOut(nil)}else{panel.orderOut(nil);folder.orderBack(nil)}
   owner.play(token)
  }
  prepare(1,false)
  let pictures=owner.checkedImages
  check(pictures.count==2,"two snapshots")
  for (i,image) in pictures.enumerated() {
   let rep=NSBitmapImageRep(cgImage:image.cgImage(forProposedRect:nil,context:nil,hints:nil)!)
   try! rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:CommandLine.arguments[1]+"/snapshot-\(i).png"))
   let centre=rep.colorAt(x:rep.pixelsWide/2,y:rep.pixelsHigh/2)!.usingColorSpace(.deviceRGB)!
   if i==0 {check(centre.blueComponent>0.95 && centre.redComponent>0.7 && centre.redComponent<0.85,"real WebKit content is composited, not a blank native backing")}
   if i==1 {check(centre.redComponent>0.9 && centre.alphaComponent>0.9,"CALayer folder artwork is included")}
  }
  Checks.pump(0.11)
  check(owner.checkedCopies.allSatisfy{$0.picture.layer?.contents != nil && $0.picture.layer?.presentation()?.contents != nil},"AppKit preserves bitmap contents after committing animated window/view geometry")
  let before=owner.checkedCopies[0].frame
  check(before.width<actualPanel.width && before.width>216,"native frame advances")
  check(panel.frame==actualPanel && folder.frame==f,"real frames never resize or travel")
  prepare(2,true)
  let after=owner.checkedCopies[0].frame
  check(abs(after.width-before.width)<90,"reversal starts at live native position")
  Checks.pump(0.05)
  check(owner.checkedCopies[0].frame.width>after.width,"reversed frame travels outward")
  Checks.pump(0.4)
  check(!owner.active && owner.checkedCopies.isEmpty,"bounded cleanup")
  check(Checks.completions==[2],"stale completion cannot finish reversal")
  check(panel.alphaValue==1 && folder.alphaValue==1 && !panel.ignoresMouseEvents && !folder.ignoresMouseEvents,"restore native appearance and input")
  for token in 3...22 {
   autoreleasepool {
   prepare(UInt64(token),token%2==0);Checks.pump(token%2==0 ? 0.38:0.27)
   check(!owner.active && owner.checkedCopies.isEmpty,"ten complete roundtrips release temporary windows")
   check(panel.frame==actualPanel && folder.frame==f,"roundtrip preserves saved/native frames")
   }
  }
  Checks.pump(0.1)
  check(Checks.retired.allSatisfy{$0.value == nil},"completed temporary windows actually deallocate; clearing owner references alone is insufficient")
  prepare(23,false);Checks.pump(0.04);owner.cancel();Checks.pump(0.35)
  check(!owner.active && !owner.preparing && owner.checkedCopies.isEmpty,"hide/preference cancellation")
  check(!Checks.completions.contains(23),"cancelled delayed fades never complete")
  check(panel.alphaValue==1 && !panel.ignoresMouseEvents,"cancellation cannot strand invisible real window")
  // Cancellation before an asynchronous WebKit reply must not revive a handoff.
  check(owner.prepare(panel:panel,folder:folder,expand:true,token:24,ready:{ token,ok in MainActor.assumeIsolated{Checks.ready(token,ok)} },completed:{ token,ok in MainActor.assumeIsolated{Checks.done(token,ok)} }),"prepare then cancel")
  owner.cancel();Checks.pump(0.3)
  check(!Checks.replies.contains{$0.0==24},"stale snapshot suppressed")
  check(owner.prepare(panel:panel,folder:folder,expand:true,token:25,ready:{ token,ok in MainActor.assumeIsolated{Checks.ready(token,ok)} },completed:{ token,ok in MainActor.assumeIsolated{Checks.done(token,ok)} }),"prepare before real resize")
  panel.setContentSize(NSSize(width:900,height:600))
  Checks.wait{Checks.replies.contains{$0.0==25}}
  check(Checks.replies.last!.1,"deferred capture uses the current native frame")
  owner.cancel();panel.setFrame(actualPanel,display:true)
  prepare(26,false);NotificationCenter.default.post(name:NSApplication.didChangeScreenParametersNotification,object:nil)
  check(!owner.active && owner.checkedCopies.isEmpty,"screen/sleep change finishes in the committed mode")
  check(Checks.completions.last==26 && panel.alphaValue==1 && !panel.ignoresMouseEvents,"environment change restores input and completes once")
  prepare(27,false);Checks.pump(0.02)
  // Model one busy main-thread interval, not an extra product delay. The old
  // duration timer discarded late-started folder/fade tracks in the same turn.
  Thread.sleep(forTimeInterval:0.26);Checks.pump(0.025)
  check(owner.active && !Checks.completions.contains(27),"a delayed native track must finish before handing over, even past the nominal duration")
  Checks.wait{Checks.completions.contains(27)}
  prepare(28,true);Checks.pump(0.08)
  let presenter=owner.checkedCopies[0]
  check(presenter.standardWindowButton(.closeButton)?.window === presenter && presenter.styleMask.contains(.titled),"native titlebar exists during expansion, not baked into content or attached at the end")
  check(abs((presenter.frame.height-presenter.picture.bounds.height)-WindowHandoff.reservedChromeHeight(panel))<0.01,"page composition respects native overlay versus reserved chrome at handover")
  Checks.wait{Checks.completions.contains(28)}
  panel.orderOut(nil);folder.orderOut(nil);web.stopLoading()
  print("AppKit handoff (\(unified ? "unified" : fullSize ? "fullsize":"classic")): live native titled presentation, delayed-track completion barrier, own-content snapshot, live reversal, 10 roundtrips, input/geometry/cleanup and stale completion checks passed.")
 }
}
`;
try{
 writeFileSync(join(scratch,'Checks.swift'),readFileSync(tokens,'utf8')+'\n'+readFileSync(resolve(import.meta.dirname,'../src-tauri/native/SearchTokens.generated.swift'),'utf8')+'\n'+readFileSync(resolve(import.meta.dirname,'../src-tauri/native/WindowChrome.swift'),'utf8')+'\n'+readFileSync(native,'utf8')+'\n'+fixture);
 run('xcrun',['swiftc','-swift-version','6','-parse-as-library','-O','-warnings-as-errors',join(scratch,'Checks.swift'),'-o',join(scratch,'Checks')]);
 process.stdout.write(run(join(scratch,'Checks'),[scratch,'classic']));
 process.stdout.write(run(join(scratch,'Checks'),[scratch,'fullsize']));
 process.stdout.write(run(join(scratch,'Checks'),[scratch,'unified']));
}finally{rmSync(scratch,{recursive:true,force:true});}
