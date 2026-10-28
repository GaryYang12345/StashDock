// Observe layers at the actual attachment boundary, before a later frame can
// hide an unsafe default centre pose. Optional revision reproduces regressions.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
if (process.platform !== 'darwin') throw Error('Run on macOS.');
const root = resolve(import.meta.dirname,'..'), revision = process.argv[2];
const scratch = mkdtempSync(join(tmpdir(),'stashdock-publication-'));
try {
  let source = ['SearchTokens.generated.swift','SearchPresentation.swift','SearchControls.swift','FolderSearch.swift'].map(name => {
    const path = `src-tauri/native/${name}`;
    if (!revision) return readFileSync(join(root,path),'utf8');
    const result = spawnSync('git',['show',`${revision}:${path}`],{cwd:root,encoding:'utf8'});
    if (result.status !== 0) throw Error(result.stderr);
    return result.stdout;
  }).join('\n');
  const needle = 'maskGradient = CAGradientLayer(), stage = CALayer()';
  if (source.split(needle).length !== 2) throw Error('Cannot instrument the native stage.');
  // The observer calls the real superclass insertion unchanged. Only the test
  // swaps this dependency; no event synthesis or test hooks in the product.
  source = source.replace(needle,'maskGradient = CAGradientLayer(), stage = PublicationStage()');
  source += String.raw`
private func require(_ value:Bool,_ message:String) {
    if !value { FileHandle.standardError.write(Data((message+"\n").utf8)); exit(1) }
}
final class PublicationStage:CALayer {
    nonisolated(unsafe) static var observe:((CALayer)->Void)?
    override func addSublayer(_ layer:CALayer) {
        Self.observe?(layer)
        super.addSublayer(layer)
    }
}
@main private struct PublicationChecks {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.prohibited)
        NSApplication.shared.finishLaunching()
        let owner=SearchOwner(callback:{ _ in })
        owner.configure(["x":-20000.0,"y":-20000.0,"anchor":240.0,"theme":"light"])
        owner.attached=true; owner.focusSearch()
        owner.input.stringValue="test"
        owner.controlTextDidChange(Notification(name:NSControl.textDidChangeNotification))
        let items=(0..<5).map { ["id":"test-\($0)","title":"Test \($0)"] }
        let data=try! JSONSerialization.data(withJSONObject:["action":"search","token":owner.queryToken,"session":owner.session,"items":items])
        owner.response(data)
        RunLoop.main.run(until:Date().addingTimeInterval(0.7))
        var start=0.0, publications=0
        PublicationStage.observe = { layer in
            MainActor.assumeIsolated {
                let slot=owner.flow.slots.values.first { $0.root === layer }!
                let expected=SearchPlacement(Double(slot.virtual)-start)
                require(expected.opacity != 0 || layer.opacity == 0,
                    "UNSAFE PUBLICATION: slot \(slot.virtual) joined at opacity \(layer.opacity), x \(layer.transform.m41); expected an invisible remote card")
                require(abs(layer.transform.m41-expected.transform.m41) < 1,
                    "UNSAFE PUBLICATION: new card joined at the centre before its real pose")
                publications += 1
            }
        }
        for delta in [1,-4,1,5,-6,2,-3,4,-1] {
            start=owner.flow.position
            owner.step(delta)
            let actual=owner.flow.stage.sublayers!.map { layer in owner.flow.slots.values.first { $0.root === layer }!.virtual }
            require(actual == actual.sorted(),"Unstable overlap order after reversal")
            RunLoop.main.run(until:Date().addingTimeInterval(0.035))
        }
        require(publications > 5,"Did not exercise both strip ends")
        PublicationStage.observe=nil
        owner.close(immediate:true)
        print("Native publication passed: \(publications) inserted cards never exposed a default centre pose; virtual paint order survives rapid reversal.")
    }
}
`;
  const path=join(scratch,'Publication.swift'), executable=join(scratch,'Publication');
  writeFileSync(path,source);
  const compile=spawnSync('xcrun',['swiftc','-parse-as-library','-swift-version','6','-O','-warnings-as-errors',path,'-o',executable],{encoding:'utf8',timeout:30000});
  if (compile.status !== 0) throw Error(compile.stderr);
  const run=spawnSync(executable,[],{encoding:'utf8',timeout:10000});
  process.stdout.write(run.stdout); process.stderr.write(run.stderr);
  if (run.status !== 0) process.exitCode=1;
} finally { rmSync(scratch,{recursive:true,force:true}); }
