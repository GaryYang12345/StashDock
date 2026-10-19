import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe, Moon, Sun } from "lucide-react";
import { Button } from "../../components/arc/button/button";
import { CopyButton } from "../../components/arc/copy-button/copy-button";
import { SearchField } from "../../components/arc/search-field/search-field";
import SegmentedControl from "../../components/arc/segmented-control/segmented-control";
import { Card } from "../../components/arc/card/card";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "../../components/arc/dialog/dialog";
import { BrandIcon } from "../../components/BrandIcon";
import { useLibrary } from "../library/useLibrary";
import { buildSearchIndex, filterItems } from "../library/selectors";
import { buildContext } from "../../lib/context";
import styles from "./DesignLab.module.css";

// An isolated, read-only workbench. Changing a preview never changes user records.
export default function DesignLab() {
  const { items, ready, error, refresh } = useLibrary();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("grid");
  const [theme, setTheme] = useState("light");
  const [accent, setAccent] = useState("neutral");
  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.getAttribute("data-theme"), previousAccent = root.getAttribute("data-accent");
    return () => {
      if (previousTheme === null) root.removeAttribute("data-theme"); else root.setAttribute("data-theme", previousTheme);
      if (previousAccent === null) root.removeAttribute("data-accent"); else root.setAttribute("data-accent", previousAccent);
    };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.accent = accent; }, [theme, accent]);
  const index = useMemo(() => buildSearchIndex(items), [items]);
  const references = useMemo(() => filterItems(items, index, query, "all").slice(0, 4), [items, index, query]);
  const context = useMemo(() => buildContext(references), [references]);
  return <main data-arc-ui className={styles.page}>
    <header className={styles.header}>
      <BrandIcon />
      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Preview dark theme" : "Preview light theme"}>
          {theme === "light" ? <Moon size={20} strokeWidth={1.75} aria-hidden="true"  /> : <Sun size={20} strokeWidth={1.75} aria-hidden="true"  />}
        </Button>
        <a href="/">Return to shelf</a>
      </div>
    </header>
    <section aria-labelledby="design-title" className={styles.intro}>
      <h1 id="design-title">A quieter context shelf</h1>
      <p>Arc controls with your saved references. This preview does not add, edit or delete anything.</p>
    </section>
    <div className={styles.filters}>
      <SearchField label="Search references" placeholder="Titles, sources, tags or content" value={query} onValueChange={setQuery} />
      <SegmentedControl label="Reference view" value={view} onValueChange={setView} options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }]} />
    </div>
    <section aria-labelledby="reference-title" aria-busy={!ready}>
      <div className={styles.sectionHeading}><h2 id="reference-title">Saved references</h2><span>{references.length} shown</span></div>
      {!ready ? <div className={styles.loading} role="status">Opening saved references</div> : error ? <div className={styles.empty} role="alert"><p>References could not be loaded. Check that StashDock is running.</p><Button variant="secondary" onClick={() => void refresh()}>Retry loading</Button></div> : references.length ?
        <div className={view === "grid" ? styles.grid : styles.list}>
          {references.map(item => <Card key={item.id} title={item.title} description={item.excerpt || undefined} meta={item.source}
            media={<div className={styles.mediaFrame}>{item.preview ? <img className={styles.preview} src={item.preview} alt="" loading="lazy" decoding="async" draggable={false} /> : <div className={styles.fallback}><Globe size={24} strokeWidth={1.75} aria-hidden="true" /><span>{item.source}</span></div>}</div>}
            action={<CopyButton value={buildContext([item])} label="Copy reference" iconOnly />}
          >{item.url && <a href={item.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>Open source<ExternalLink size={16} strokeWidth={1.75} aria-hidden="true"  /></a>}</Card>)}
        </div> : <div className={styles.empty}><p>{query ? "No references match this search." : "No saved references yet. Save a page with the browser extension."}</p>{query && <Button variant="secondary" onClick={() => setQuery("")}>Clear search</Button>}</div>}
    </section>
    <footer className={styles.footer}>
      <div className={styles.actions}>
        <CopyButton value={context} label="Copy shown references" disabled={!references.length} />
        <Dialog>
          <DialogTrigger asChild><Button variant="secondary">Preview export format</Button></DialogTrigger>
          <DialogContent title="Structured context" description="Each reference includes its source, link and saved content. No AI processing is added here.">
            <pre className={styles.context}>{references.length ? context : "Save a reference to preview its export."}</pre>
            <DialogClose asChild><Button variant="primary">Close preview</Button></DialogClose>
          </DialogContent>
        </Dialog>
      </div>
      <SegmentedControl label="Preview accent" value={accent} onValueChange={setAccent} options={[{ value: "neutral", label: "Neutral" }, { value: "blue", label: "Blue" }]} />
    </footer>
  </main>;
}
