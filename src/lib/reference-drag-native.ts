import { invoke, isTauri } from "@tauri-apps/api/core";

export async function dragReferenceFile(itemIds: string[], preview: string, hotspot?: {x: number; y: number}) {
  if (!isTauri()) throw new Error("File dragging requires the StashDock desktop window.");
  // Source-owned IPC only. A browser sidebar cannot hand its gesture to another process.
  const result = await invoke<{dropped: boolean; status: string}>("drag_reference_file", {itemIds, preview, ...(hotspot ? {hotspot} : {})});
  if (result.status === "released-before-start") throw new Error("The drag ended before it could start. Hold the card while moving it.");
  if (result.status === "rejected") throw new Error("This target did not accept the references. Try Copy for AI instead.");
  if (result.dropped !== true && result.status !== "cancelled") throw new Error("The references were not dropped. Try Copy for AI instead.");
  return result.dropped === true;
}
