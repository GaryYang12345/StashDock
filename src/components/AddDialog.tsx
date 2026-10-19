import { Bookmark, FileUp, Link, SquarePen, Plus } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { useRef, useState } from "react";
import { FluidDialog } from "./FluidDialog";
import { Button } from "./arc/button/button";
import { Input } from "./arc/input/input";
import { Textarea } from "./arc/textarea/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./arc/tabs/tabs";
import { Alert } from "./arc/alert/alert";
import styles from "./AddDialog.module.css";
import { canonicalizeUrl, parseBrowserBookmarks, type BookmarkImportResult } from "../lib/bookmarks";
import { chooseAndImportFiles } from "../lib/storage";
import type { StashItem, StashKind } from "../types";

type AddDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (items: StashItem[], persisted?: boolean) => Promise<void>;
  onImportFiles?: (files: File[]) => Promise<StashItem[]>;
};

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function tagsFrom(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);
}

type AddMode = "bookmarks" | "link" | "note" | "file";

async function fileToItem(file: File): Promise<StashItem> {
  let kind: StashKind = "file";
  if (file.type.startsWith("image/")) kind = "image";
  if (file.type === "application/pdf") kind = "pdf";

  let preview: string | undefined;
  if (kind === "image" && file.size < 1_500_000) {
    preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("The image could not be read."));
      reader.readAsDataURL(file);
    });
  }

  return {
    id: makeId(),
    title: file.name,
    kind,
    source: "Local file",
    excerpt: `${file.type || "File"} · ${(file.size / 1024).toFixed(file.size > 1024 * 100 ? 0 : 1)} KB`,
    tags: [kind === "image" ? "Image" : kind === "pdf" ? "PDF" : "File"],
    createdAt: new Date().toISOString(),
    preview,
    origin: {
      platform: "Local file",
      importMethod: "local_file",
      importedAt: new Date().toISOString(),
    },
  };
}

export function AddDialog({ open, onClose, onAdd, onImportFiles }: AddDialogProps) {
  const [mode, setMode] = useState<AddMode>("bookmarks");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [bookmarkResult, setBookmarkResult] = useState<BookmarkImportResult | null>(null);
  const [bookmarkFileName, setBookmarkFileName] = useState("");
  const urlRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setUrl("");
    setTitle("");
    setContent("");
    setTags("");
    setError("");
    setBookmarkResult(null);
    setBookmarkFileName("");
    setMode("bookmarks");
  };
  const commit = async (items: StashItem[], persisted = false) => {
    setImporting(true);
    try { await onAdd(items, persisted); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "These references could not be saved. Please try again."); }
    finally { setImporting(false); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (importing) return;
    setError("");

    if (mode === "link") {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        setError("Enter a complete URL, including https://");
        return;
      }
      if (!/^https?:$/.test(parsed.protocol)) { setError("Use an http:// or https:// web link."); return; }
      const isRepo = parsed.hostname === "github.com";
      const canonicalUrl = canonicalizeUrl(parsed.toString());
      await commit([
        {
          id: makeId(),
          title: title.trim() || parsed.hostname.replace(/^www\./, ""),
          kind: isRepo ? "repo" : "web",
          source: isRepo ? "GitHub" : parsed.hostname.replace(/^www\./, ""),
          url: canonicalUrl,
          excerpt: content.trim() || "Saved from the web. Open the source to review the full content.",
          tags: tagsFrom(tags),
          createdAt: new Date().toISOString(),
          origin: {
            platform: parsed.hostname.replace(/^www\./, ""),
            importMethod: "manual_url",
            externalId: canonicalUrl,
            importedAt: new Date().toISOString(),
          },
        },
      ]);
      return;
    }

    if (mode === "note") {
      if (!title.trim() || !content.trim()) {
        setError("Add a title and some useful context.");
        return;
      }
      await commit([
        {
          id: makeId(),
          title: title.trim(),
          kind: "note",
          source: "Personal note",
          excerpt: content.trim(),
          tags: tagsFrom(tags),
          createdAt: new Date().toISOString(),
          origin: {
            platform: "StashDock",
            importMethod: "note",
            importedAt: new Date().toISOString(),
          },
        },
      ]);
    }
  };

  const receiveBookmarkFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setBookmarkResult(null);
    setBookmarkFileName(file.name);
    setImporting(true);
    try {
      const result = parseBrowserBookmarks(await file.text());
      if (!result.items.length) {
        setError("No web bookmarks were found. Export bookmarks as an HTML file and try again.");
        return;
      }
      setBookmarkResult(result);
    } catch {
      setError("This bookmark export could not be read.");
    } finally {
      setImporting(false);
    }
  };

  const importBookmarks = async () => {
    if (!bookmarkResult || importing) return;
    const batchTags = tagsFrom(tags);
    const items = bookmarkResult.items.map((item) => ({
      ...item,
      tags: Array.from(new Set([...item.tags, ...batchTags])).slice(0, 6),
    }));
    await commit(items);
  };

  const receiveFiles = async (files: FileList | null) => {
    if (!files?.length || importing) return;
    setError(""); setImporting(true);
    try { await commit(onImportFiles ? await onImportFiles(Array.from(files)) : await Promise.all(Array.from(files).map(fileToItem)), Boolean(onImportFiles)); }
    catch (error) { setError(error instanceof Error ? error.message : "Those files could not be read."); }
    finally { setImporting(false); }
  };

  const receiveDesktopFiles = async () => {
    setError("");
    setImporting(true);
    try {
      const items = await chooseAndImportFiles();
      if (!items.length) return;
      await commit(items, true);
    } catch {
      setError("Those files could not be copied into the local library.");
    } finally {
      setImporting(false);
    }
  };

  const tagsField = <Input label="Tags (optional)" description="Separate tags with commas." value={tags} onChange={event => setTags(event.target.value)} placeholder="Research, inspiration, product" disabled={importing} />;
  return <FluidDialog open={open} onClose={onClose} onExited={resetForm} busy={importing} title="Import references" description="Keep useful links and context together.">
    <Tabs value={mode} onValueChange={value => { if (!importing) { setMode(value as AddMode); setError(""); } }}>
      <TabsList aria-label="Import method">
        <TabsTrigger value="bookmarks" disabled={importing}><Bookmark size={16} strokeWidth={1.75} aria-hidden="true" />Bookmarks</TabsTrigger>
        <TabsTrigger value="link" disabled={importing}><Link size={16} strokeWidth={1.75} aria-hidden="true" />Link</TabsTrigger>
        <TabsTrigger value="note" disabled={importing}><SquarePen size={16} strokeWidth={1.75} aria-hidden="true" />Note</TabsTrigger>
        <TabsTrigger value="file" disabled={importing}><FileUp size={16} strokeWidth={1.75} aria-hidden="true" />File</TabsTrigger>
      </TabsList>
      <TabsContent value="bookmarks">
        <div className={styles.fields}>
          <p className={styles.description}>Export bookmarks as HTML from Chrome, Edge, or Firefox. Nothing is uploaded.</p>
          {tagsField}
          <div className={styles.fileField}>
            <label htmlFor="bookmark-export">Bookmarks HTML</label>
            <input id="bookmark-export" type="file" accept=".html,.htm,text/html" disabled={importing} aria-describedby="bookmark-result" onChange={event => void receiveBookmarkFile(event.target.files?.[0])} />
          </div>
          <p id="bookmark-result" className={styles.description} role="status">{importing ? "Processing references…" : bookmarkResult ? `${bookmarkFileName}: ${bookmarkResult.items.length} references ready${bookmarkResult.skipped ? ` · ${bookmarkResult.skipped} duplicates or unsupported links skipped` : ""}` : "Choose an export to preview the import."}</p>
          <div className={styles.actions}><Button variant="primary" loading={importing} disabled={!bookmarkResult} onClick={() => void importBookmarks()}>Import references</Button></div>
        </div>
      </TabsContent>
      {(["link", "note"] as const).map(value => <TabsContent key={value} value={value}>
        <form className={styles.fields} onSubmit={submit}>
          {value === "link" && <Input ref={urlRef} label="Web link" type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com" disabled={importing} />}
          <Input label={value === "link" ? "Title (optional)" : "Title"} required={value === "note"} value={title} onChange={event => setTitle(event.target.value)} placeholder={value === "link" ? "Inferred from the URL" : "What is this about?"} disabled={importing} />
          <Textarea label={value === "link" ? "Context note (optional)" : "Content"} required={value === "note"} value={content} onChange={event => setContent(event.target.value)} placeholder={value === "link" ? "Why might this be useful later?" : "Write or paste useful context"} rows={3} disabled={importing} />
          {tagsField}
          <div className={styles.actions}>
            <Button type="button" variant="ghost" disabled={importing} onClick={onClose}>Cancel import</Button>
            <Button type="submit" variant="primary" loading={importing}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />Save reference</Button>
          </div>
        </form>
      </TabsContent>)}
      <TabsContent value="file">
        <div className={styles.fields}>
          <p className={styles.description}>{isTauri() || onImportFiles ? `Files are copied into StashDock. The originals stay untouched.${onImportFiles ? ' Up to 5 MB per file and 10 MB per import. Text files include their content; other files retain their local file reference.' : ''}` : "Browser preview stores metadata locally. Use the desktop app to keep managed file copies."}</p>
          {isTauri() ? <Button variant="primary" loading={importing} onClick={() => void receiveDesktopFiles()}><FileUp size={16} strokeWidth={1.75} aria-hidden="true" />Choose files</Button>
            : <div className={styles.fileField}><label htmlFor="reference-files">Files to import</label><input id="reference-files" type="file" multiple disabled={importing} onChange={event => void receiveFiles(event.target.files)} /></div>}
        </div>
      </TabsContent>
    </Tabs>
    <Alert className={styles.error} tone="danger" title="Import needs attention" open={Boolean(error)}>{error}</Alert>
  </FluidDialog>;
}
