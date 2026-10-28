// AppKit integration fixture, isolated from Tauri, user libraries and pasteboard.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { spring } from 'motion';
if (process.platform !== 'darwin') throw Error('Verify AppKit search on macOS.');
const scratch = mkdtempSync(join(tmpdir(), 'stashdock-native-search-'));
const native = resolve(import.meta.dirname,'../src-tauri/native');
const sources = ['SearchTokens.generated.swift','SearchPresentation.swift','SearchControls.swift','FolderSearch.swift'].map(name=>readFileSync(join(native,name),'utf8')).join('\n');
const web = readFileSync(resolve(import.meta.dirname,'../src/features/folder-search/FolderSearch.tsx'),'utf8');
const body = web.slice(web.indexOf('function place(d:'),web.indexOf('\n}\n',web.indexOf('function place(d:'))+2).replace('d: number','d');
const metric = name => Number(web.match(new RegExp(`\\b${name} = ([\\d.]+)`))[1]);
const place = new Function('clamp','CARD',`${body};return place`)((v,a,b)=>Math.min(b,Math.max(a,v)),metric('CARD'));
const reference = {
  geometry:{field:metric('FIELD'),flow:metric('FLOW'),card:metric('CARD')},
  interaction:{debounce:metric('SEARCH_DELAY')/1000,copied:metric('COPIED_MS')/1000},
  placements:[-2,-1.5,-1,-.55,-.5,-.45,-.25,0,.25,.45,.5,.55,1,1.5,2].map(d=>{const p=place(d); const n=[...p.transform.matchAll(/\(([-\d.e+]+)(?:px|deg)?\)/g)].map(m=>Number(m[1]));return {d,x:n[0],z:n[1],angle:n[2],scale:n[3],opacity:p.opacity,order:p.z}}),
  springs:[{from:0,to:1,velocity:0,stiffness:340,damping:34},{from:1.2,to:-2.4,velocity:12,stiffness:340,damping:34},{from:18,to:0,velocity:0,stiffness:(2*Math.PI/(.4*1.2))**2,damping:2*(2*Math.PI/(.4*1.2))}].map(p=>({...p,frames:[.013,.04,.1,.18,.28,.35].map(t=>({t,value:spring({keyframes:[p.from,p.to],velocity:p.velocity,stiffness:p.stiffness,damping:p.damping}).next(t*1000).value}))}))
};
for (const [kind,visualDuration,bounce] of [['morph',.42,.16],['snappy',.26,.12]]) {
  reference.springs.push({kind,from:82,to:99,velocity:0,frames:[.013,.04,.1,.18,.28,.35].map(t=>{const state=spring({keyframes:[82,99],visualDuration,bounce}).next(t*1000);return {t,value:state.value,done:state.done?1:0}})});
}
const referencePath = join(scratch,'windows-contract.json'); writeFileSync(referencePath,JSON.stringify(reference));
const fixture = String.raw`
private func check(_ condition: @autoclosure () -> Bool, line: Int = #line) {
    if !condition() { FileHandle.standardError.write(Data("Check failed at line \(line)\n".utf8)); exit(1) }
}

@MainActor private enum SearchChecks {
    static var events: [[String: Any]] = []
    static func pump(_ seconds: Double) { RunLoop.main.run(until: Date().addingTimeInterval(seconds)) }
    static func payload(_ owner: SearchOwner, _ values: [String: Any]) -> Data {
        var values = values; values["session"] = owner.session
        return try! JSONSerialization.data(withJSONObject: values)
    }
}
// Inspect the submitted trajectories, rather than mistaking elapsed execution
// time during a busy build machine for a visible position discontinuity.
extension SearchFlow {
    fileprivate var checkedMovement: SearchSpring? { movement }
    fileprivate var checkedGeneration:UInt64 { motionGeneration }
    fileprivate func checkStaleCompletion(_ generation:UInt64) { settle(generation:generation) }
}
extension SearchScalarAnimation {
    fileprivate var checkedMovement: SearchSpring? { movement }
}
@main private struct NativeSearchChecks {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.prohibited)
        NSApplication.shared.finishLaunching()
        SearchTypeface.register(URL(fileURLWithPath:CommandLine.arguments[2]))
        check(SearchTypeface.font(14).familyName == "Inter")
        print("Native Copy widths (same bundled Inter, no title tracking):",SearchCopyPresentation.naturalWidth("Copy"),SearchCopyPresentation.naturalWidth("Copied"))
        let widthLayer=CALayer(), widthDriver=SearchScalarAnimation([(widthLayer,"bounds.size.width",1)])
        widthDriver.set(82,spring:"morph"); widthDriver.set(99,spring:"morph")
        SearchChecks.pump(0.06)
        let oldWidthMotion=widthDriver.checkedMovement!
        widthDriver.set(82,spring:"morph")
        let newWidthMotion=widthDriver.checkedMovement!
        check(abs(newWidthMotion.from-oldWidthMotion.state(newWidthMotion.start-oldWidthMotion.start).value) < 0.000001)
        check(newWidthMotion.velocity == 0) // Actual Motion time-defined retarget rule.
        let owner = SearchOwner(callback: { raw in
            MainActor.assumeIsolated {
                let data = String(cString:raw).data(using:.utf8)!
                SearchChecks.events.append(try! JSONSerialization.jsonObject(with:data) as! [String:Any])
            }
        })
        // Screen-intersecting top-edge placements exercise AppKit's own window
        // constraints. A wholly offscreen fixture never enters that path.
        for screen in NSScreen.screens {
            for offset in [0.0, 32.0, 125.0, 400.0] {
                let expected = NSPoint(x:screen.visibleFrame.midX-240,y:screen.visibleFrame.maxY-offset-40)
                owner.configure(["x":Double(expected.x),"y":Double(expected.y),"anchor":240.0,"theme":"light"])
                owner.attached = true; owner.hover(true)
                SearchChecks.pump(SearchDesign.interaction("intent")+0.04)
                check(owner.open && owner.panel.frame.origin == expected)
                owner.focusSearch()
                SearchChecks.pump(0.04)
                print("Top-edge search placement requested:",expected,"actual:",owner.panel.frame.origin)
                check(owner.panel.frame.origin == expected)
                let field = owner.panel.convertToScreen(owner.fieldSurface.convert(owner.fieldSurface.bounds,to:nil))
                let folderTop = screen.visibleFrame.maxY-offset
                check(abs(field.minY-(folderTop-8)) < 0.01 && field.maxY > folderTop)
                owner.close(immediate:true)
            }
        }
        owner.configure(["x":-20000.0,"y":-20000.0,"anchor":240.0,"chinese":false,"theme":"light"])
        owner.attached = true
        owner.focusSearch()
        SearchChecks.pump(0.05)
        check(owner.open && owner.panel.isVisible)
        check(!owner.panel.isOpaque && owner.panel.styleMask.contains(.nonactivatingPanel))
        let fieldCentre = owner.fieldSurface.layer!.presentation()!.convert(NSPoint(x:92,y:22),to:owner.canvas.layer!.presentation()!)
        check(abs(fieldCentre.x-owner.anchor) < 0.01)
        owner.input.stringValue = "acceptance"
        owner.controlTextDidChange(Notification(name:NSControl.textDidChangeNotification))
        SearchChecks.pump(0.18)
        let query = SearchChecks.events.last { $0["action"] as? String == "search" }!
        check(query["query"] as? String == "acceptance")
        check(!owner.clear.isHidden && owner.clear.isEnabled)
        owner.response(SearchChecks.payload(owner,["action":"search","token":"stale","items":[["id":"old","title":"Wrong"]]]))
        check(owner.cards.isEmpty)
        owner.response(SearchChecks.payload(owner,["action":"search","token":query["token"]!,"items":[["id":"a","title":"First"],["id":"b","title":"Second"],["id":"c","title":"Third"]]]))
        check(owner.cards.count == 3 && owner.flow.slots.count == 5)
        check(owner.cards[owner.cardIndex].title == "First")
        check(!owner.offerDrag(SearchChecks.payload(owner,["token":"released-gesture","paths":["/tmp/unavailable-test-file"]])))
        check(owner.flow.hit(NSPoint(x:60,y:88))?.0.virtual == -1)
        check(owner.flow.hit(NSPoint(x:370,y:88))?.0.virtual == 1)
        check(owner.flow.hit(NSPoint(x:230,y:88))?.0.virtual == 0)
        // Check the COMPOSITOR after AppKit has committed view geometry. A
        // model-only anchor check missed AppKit resetting its backing anchor
        // to zero: scaling then moved the centre left and up diagonally.
        for wait in [0.025,0.04,0.08,0.14] {
            SearchChecks.pump(wait)
            let face = owner.flow.slots[0]!.root.presentation()!
            let canvas = owner.canvas.layer!.presentation()!
            let centre = face.convert(NSPoint(x:116,y:84),to:canvas)
            check(abs(centre.x-owner.anchor) < 0.01)
            check(centre.y >= 140 && centre.y <= 157.53)
            let left = face.convert(NSPoint(x:0,y:0),to:canvas)
            let right = face.convert(NSPoint(x:232,y:0),to:canvas)
            check(abs(left.y-right.y) < 0.01) // Front card never tilts on entry.
            check(owner.flow.motionRoot.presentation()!.anchorPoint == NSPoint(x:0.5,y:1))
            check(CATransform3DIsIdentity(owner.flow.layer!.presentation()!.transform))
        }
        check(owner.flow.motionRoot.filters == nil) // No steady CI resampling.
        // Projected hit testing agrees with Core Animation's own forward map.
        for card in owner.flow.slots.values where abs(card.virtual) <= 1 {
            for local in [NSPoint(x:116,y:84),NSPoint(x:40,y:30),NSPoint(x:190,y:140)] {
                let projected = card.root.convert(local,to:owner.flow.layer)
                let inverted = SearchPlacement(Double(card.virtual)).localPoint(NSPoint(x:projected.x-230,y:projected.y-88))!
                check(hypot(inverted.x-local.x,inverted.y-local.y) < 0.01)
            }
        }
        // No mouse-move event after this: an arriving card must hover BEFORE
        // the spring's small settling tail ends, and outside must stay outside.
        SearchChecks.pump(0.65)
        let fixedPointer = NSPoint(x:230,y:88)
        owner.flow.trackPointer(fixedPointer)
        check(owner.flow.slots[0]!.hovered)
        owner.step(1); owner.flow.trackPointer(fixedPointer)
        check(!owner.flow.slots[1]!.hovered)
        SearchChecks.pump(0.18)
        check(owner.flow.slots[1]!.hovered && abs(owner.flow.position-1) > 0.005)
        owner.flow.trackPointer(NSPoint(x:0,y:-100))
        SearchChecks.pump(0.04)
        check(!owner.flow.slots.values.contains { $0.hovered })
        owner.step(-1); owner.flow.trackPointer(fixedPointer)
        SearchChecks.pump(0.22)
        check(owner.flow.slots[0]!.hovered)
        SearchChecks.pump(0.6)
        check(owner.flow.slots[0]!.hovered) // Settling preserves the last real pointer event.
        owner.step(1)
        check(owner.cards[owner.cardIndex].title == "Second")
        SearchChecks.pump(0.10)
        let previousMovement = owner.flow.checkedMovement!
        let oldGeneration = owner.flow.checkedGeneration
        owner.step(-1)
        let reversedMovement = owner.flow.checkedMovement!
        let interruption = previousMovement.state(reversedMovement.start-previousMovement.start)
        check(abs(reversedMovement.from-interruption.value) < 0.000001)
        check(abs(reversedMovement.velocity-interruption.velocity) < 0.000001)
        owner.flow.checkStaleCompletion(oldGeneration)
        check(owner.flow.checkedMovement?.start == reversedMovement.start)
        SearchChecks.pump(0.75)
        check(abs(owner.flow.position) < 0.005)
        owner.step(1)
        for _ in 0..<96 { owner.step(1) }
        check(owner.cardIndex == 1 && owner.flow.slots.count <= 37)
        owner.response(SearchChecks.payload(owner,["action":"search","token":query["token"]!,"items":[["id":"a","title":"First"],["id":"b","title":"Updated second"],["id":"c","title":"Third"]]]))
        check(owner.cardIndex == 1 && owner.flow.slots[owner.selected]?.card.title == "Updated second")
        SearchChecks.pump(0.75)
        let copyWidth = owner.flow.slots[owner.selected]!.copyRect.width
        owner.flow.trackPointer(NSPoint(x:230+223-copyWidth-4-116,y:88+141-84))
        let before = SearchChecks.events.filter { $0["action"] as? String == "copy" }.count
        _ = owner.control(owner.input,textView:NSTextView(),doCommandBy:NSSelectorFromString("insertNewline:"))
        check(SearchChecks.events.filter { $0["action"] as? String == "copy" }.count == before)
        owner.copyCurrent(); owner.copyCurrent()
        check(SearchChecks.events.filter { $0["action"] as? String == "copy" }.count == before + 1)
        let activeCard = owner.flow.slots[owner.selected]!
        let coverBeforeCopy = activeCard.artwork.contents as! CGImage
        let widthBeforeCopy = activeCard.copyRect.width
        check(activeCard.copyPresentation.labelHost.opacity == 0 && activeCard.copy.opacity > 0.9)
        owner.response(SearchChecks.payload(owner,["action":"copy","id":"b"]))
        check(owner.copyPending && owner.copiedId == "b")
        check(activeCard.copyPresentation.targetWidth > widthBeforeCopy)
        check(activeCard.copyRect.width < activeCard.copyPresentation.targetWidth)
        check((activeCard.artwork.contents as! CGImage) === coverBeforeCopy)
        SearchChecks.pump(0.18)
        check(activeCard.copyPresentation.labelHost.opacity == 1)
        check(abs(activeCard.copy.opacity-0.91) < 0.001) // Widening Copy reaches the stationary pointer.
        check(activeCard.copyPresentation.labelHost.sublayers?.count == 1)
        check(!owner.copyPending && owner.copiedId == "b")
        SearchChecks.pump(1.67)
        check(owner.copiedId.isEmpty) // 1800ms from completion, not 160+1800ms.
        owner.copyCurrent()
        check(SearchChecks.events.filter { $0["action"] as? String == "copy" }.count == before + 2)
        owner.response(SearchChecks.payload(owner,["action":"search","token":query["token"]!,"items":[["id":"a","title":"First"],["id":"b","title":"Second"]]]))
        check(owner.flow.slots.count == 2 && Set(owner.flow.slots.values.map { $0.card.id }).count == 2)
        owner.step(-1); check(owner.selected == 0)
        owner.step(1); owner.step(1); check(owner.selected == 1)
        // Only visible identities request remote enrichment. Stale icons cannot
        // replace a newer query or reset its carousel selection.
        owner.response(SearchChecks.payload(owner,["action":"search","token":query["token"]!,"items":[["id":"web-a","title":"Web A","webMark":true],["id":"web-b","title":"Web B","webMark":true]]]))
        let markRequests = SearchChecks.events.filter { $0["action"] as? String == "marks" }
        check((markRequests.last!["ids"] as? [String]) == ["web-a","web-b"])
        owner.step(1)
        check(SearchChecks.events.filter { $0["action"] as? String == "marks" }.count == markRequests.count)
        let png = NSBitmapImageRep(cgImage:searchBitmap(NSSize(width:16,height:16),scale:1) { NSColor.red.setFill(); NSRect(x:0,y:0,width:16,height:16).fill() }).representation(using:.png,properties:[:])!
        let mark = "data:image/png;base64," + png.base64EncodedString()
        owner.response(SearchChecks.payload(owner,["action":"mark","token":"stale","id":"web-b","mark":mark]))
        check(owner.cards[1].mark == nil)
        owner.response(SearchChecks.payload(owner,["action":"mark","token":query["token"]!,"id":"web-b","mark":mark]))
        check(owner.cards[1].mark == mark && owner.selected == 1)
        owner.clearQuery()
        check(!owner.clear.isEnabled && !owner.clear.isHidden)
        SearchChecks.pump(0.03)
        owner.input.stringValue = "new pending query"
        owner.controlTextDidChange(Notification(name:NSControl.textDidChangeNotification))
        // Clear/typing reversal must cancel the old delayed button removal.
        SearchChecks.pump(0.15)
        check(!owner.clear.isHidden && owner.clear.isEnabled)
        let late = SearchChecks.payload(owner,["action":"search","token":query["token"]!,"items":[["id":"old","title":"Wrong"]]])
        owner.close(immediate:true)
        owner.response(late)
        check(!owner.open && !owner.panel.isVisible && owner.panel.ignoresMouseEvents && owner.cards.isEmpty)
        // A cancelled delayed hide cannot hide a newly reopened session.
        owner.focusSearch(); owner.close(); owner.focusSearch()
        check(SearchChecks.events.last { $0["action"] as? String == "visibility" && $0["visible"] as? Bool == false }?["releaseDelay"] as? Double == 0.26)
        SearchChecks.pump(0.4)
        check(owner.open && owner.panel.isVisible)
        owner.configure(["chinese":true,"anchor":220.0,"theme":"dark"])
        check(owner.input.placeholderAttributedString?.string == "搜索" && owner.fieldSurface.frame.minY == 240)
        visibility(owner.fieldSurface.layer!,showing:true,field:true,initial:true)
        SearchChecks.pump(0.035)
        let aboveFieldCentre = owner.fieldSurface.layer!.presentation()!.convert(NSPoint(x:92,y:22),to:owner.canvas.layer!.presentation()!)
        check(abs(aboveFieldCentre.x-220) < 0.01)
        owner.input.stringValue = "above-folder motion"
        owner.controlTextDidChange(Notification(name:NSControl.textDidChangeNotification))
        owner.response(SearchChecks.payload(owner,["action":"search","token":owner.queryToken,"items":[["id":"above-a","title":"Above A"],["id":"above-b","title":"Above B"],["id":"above-c","title":"Above C"]]]))
        SearchChecks.pump(0.045)
        let aboveFace = owner.flow.slots[0]!.root.presentation()!
        let aboveCentre = aboveFace.convert(NSPoint(x:116,y:84),to:owner.canvas.layer!.presentation()!)
        check(abs(aboveCentre.x-220) < 0.01 && aboveCentre.y >= 140 && aboveCentre.y < owner.fieldSurface.frame.minY)
        check(owner.flow.motionRoot.filters != nil)
        check(owner.flow.motionRoot.animation(forKey:"filters") == nil)
        owner.step(1) // Input during entrance must immediately remove blur.
        check(owner.flow.motionRoot.filters == nil)
        let submitted = owner.flow.slots[1]!.root.animation(forKey:"cover-flow") as! CAAnimationGroup
        check(submitted.animations!.allSatisfy { $0.duration == submitted.duration })
        owner.flow.animateRetirement()
        SearchChecks.pump(0.26)
        // The cancelled entrance cleanup cannot remove a newer exit filter.
        check(owner.flow.motionRoot.filters != nil)
        check((owner.flow.motionRoot.value(forKeyPath:"filters.searchBlur.inputRadius") as! Double) == 2)
        owner.close(immediate:true)
        // Pressing/dragging a folder suppresses every search opening path,
        // including delayed hover, focus accelerators and a moved-frame attach.
        owner.hover(true); SearchChecks.pump(0.06)
        owner.folderGesture(true)
        owner.hover(true); owner.searchHover=true; owner.focusSearch()
        SearchChecks.pump(0.23)
        check(!owner.open && !owner.panel.isVisible)
        owner.configure(["x":-21000.0,"y":-20500.0,"anchor":240.0,"theme":"light"])
        owner.folderGesture(false)
        SearchChecks.pump(0.2)
        check(!owner.open && !owner.panel.isVisible && !owner.searchHover && !owner.folderHover)
        owner.hover(true); SearchChecks.pump(0.2)
        check(owner.open && owner.panel.frame.origin == NSPoint(x:-21000,y:-20500))
        owner.hover(false); SearchChecks.pump(0.11)
        owner.hover(false); SearchChecks.pump(0.11)
        check(!owner.open) // A repeated outside report never restarts 180ms.
        owner.hover(true); SearchChecks.pump(0.2)
        check(owner.open)
        owner.folderGesture(true); owner.hover(true); SearchChecks.pump(0.34)
        check(!owner.open && !owner.panel.isVisible)
        check(SearchChecks.events.last { $0["action"] as? String == "visibility" && $0["visible"] as? Bool == false }?["releaseDelay"] as? Double == 0)
        owner.folderGesture(false); owner.detach(hide:false)
        check(!owner.folderHover && !owner.searchHover)
        owner.folderGesture(true); owner.detach(hide:true)
        check(!owner.folderGestureActive && !owner.attached)
        owner.attached = false; owner.hover(true)
        SearchChecks.pump(0.22)
        check(!owner.open)
        // Native geometry against the actual Windows CSS border-box layout.
        let cell = owner.input.cell as! CenteredSearchCell
        check(abs(cell.drawingRect(forBounds:owner.input.bounds).midY - 22) < 0.01)
        check(owner.input.frame.minX == 43 && owner.input.frame.width == 92)
        let contract = try! JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))) as! [String:Any]
        for (key,value) in contract["interaction"] as! [String:Double] { check(SearchDesign.interaction(key) == value) }
        check(SearchDesign.interaction("intent") == 0.18)
        check(SearchDesign.interaction("closeStagger") + SearchDesign.duration("standard") == 0.31)
        let geometry = contract["geometry"] as! [String:Double]
        check(owner.fieldSurface.bounds.width == geometry["field"] && owner.flow.bounds.width == geometry["flow"])
        for row in contract["placements"] as! [[String:Any]] {
            let p = SearchPlacement(row["d"] as! Double)
            check(abs(Double(p.opacity)-(row["opacity"] as! Double)) < 0.000001)
            check(abs(p.x-(row["x"] as! Double)) < 0.000001)
            check(abs(p.z-(row["z"] as! Double)) < 0.000001)
            check(abs(p.angle*180/Double.pi-(row["angle"] as! Double)) < 0.000001)
            check(abs(p.scale-(row["scale"] as! Double)) < 0.000001)
            check(abs(p.order-((row["order"] as! Double)-100)*0.001) < 0.000001)
        }
        check(SearchPlacement(1).opacity == 0.75 && SearchPlacement(0).opacity == 1)
        check(SearchPlacement(1.5).opacity > 0 && SearchPlacement(1.5).opacity < 1)
        check(SearchPlacement(1+0.75/1.1+0.000001).opacity == 0)
        for row in contract["springs"] as! [[String:Any]] {
            let values = (row["kind"] as? String).map(SearchDesign.spring) ?? (row["stiffness"] as! Double,row["damping"] as! Double)
            let physics = SearchSpring(from:row["from"] as! Double,to:row["to"] as! Double,velocity:row["velocity"] as! Double,stiffness:values.0,damping:values.1,start:0)
            for frame in row["frames"] as! [[String:Double]] {
                if frame["done"] == 1 { check(frame["t"]! >= physics.duration-1/120); check(frame["value"] == physics.to) }
                else { check(abs(physics.state(frame["t"]!).value-frame["value"]!) < 0.000001) }
            }
        }
        print("Native AppKit checks passed: presentation-layer vertical entrance in both themes, no scrolling/steady blur, interruption-safe blur cleanup, explicit group timing, Windows spring/placement contract, Clear reversal, Copy width/label/loading transitions, visible-only favicon requests and stale guards, centred text, stationary-pointer hover during motion, projected hit testing, owner-derived timing, five slots, no duplicate finite results, reversal, settled-result retention, lifecycle, nonactivation, search generations, selection, explicit copy, retry, close/reopen, localization, fixed above-folder layout.")
    }
}
`;
try {
  const path = join(scratch, 'SearchChecks.swift'), executable = join(scratch, 'SearchChecks');
  writeFileSync(path,sources+'\n'+fixture);
  const compile = spawnSync('xcrun',['swiftc','-parse-as-library','-swift-version','6','-O','-warnings-as-errors','-target',`${process.arch==='arm64'?'arm64':'x86_64'}-apple-macos14.0`,path,'-o',executable],{encoding:'utf8',timeout:30000});
  if (compile.status !== 0) throw Error(compile.stderr || 'Compile AppKit fixture failed');
  const run = spawnSync(executable,[referencePath,resolve(import.meta.dirname,'../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')],{encoding:'utf8',timeout:15000});
  if (run.status !== 0) { const line = Number(run.stderr.match(/line (\d+)/)?.[1]); process.stderr.write((sources+'\n'+fixture).split('\n').slice(line-2,line+1).join('\n')+'\n'); throw Error(JSON.stringify({status:run.status,signal:run.signal,error:String(run.error||''),stdout:run.stdout,stderr:run.stderr})); }
  process.stdout.write(run.stdout);
} finally { rmSync(scratch,{recursive:true,force:true}); }
