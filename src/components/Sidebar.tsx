import { useI18n } from '../features/settings/locale';
import { Archive, History, FileText, Globe, Star, Tag, ChevronRight, Pin, PinOff, Settings } from "lucide-react";
import { tagEditActions } from './referenceActions';
import { DesktopMenu } from './DesktopMenu';
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";
import { motionTokens } from "./arc/lib/motion-tokens";
import type { CollectionFilter } from "../types";
import { BrandIcon } from "./BrandIcon";
import { handleTitlebarDrag } from "../lib/desktopWindows";
import { Button } from "./arc/button/button";
import { ScrollArea } from "./arc/scroll-area/scroll-area";
import styles from "./Sidebar.module.css";

const navigation = [
  { id: "all", label: "All", icon: Archive },
  { id: "recent", label: "Recent", icon: History },
  { id: "web", label: "Web", icon: Globe },
  { id: "files", label: "Files", icon: FileText },
  { id: "favorites", label: "Favorites", icon: Star },
] as const;

// One mounted pill, not a new gray surface at the destination. Coordinates are
// relative to the list, so scrolling tags carries the pill with its own content.
function NavigationGroup({ label, active, children }: { label: string; active: string | null; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const initialized = useRef(false);
  const [target, setTarget] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const reduced = useReducedMotionPreference();
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => {
      const button = Array.from(node.querySelectorAll<HTMLButtonElement>("button[data-navigation]")).find(button => button.dataset.navigation === active);
      if (!button) { setTarget(null); return; }
      // Layout coordinates ignore the native panel's opening scale transform.
      const next = { x: button.offsetLeft, y: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight };
      setTarget(current => current && Object.keys(next).every(key => current[key as keyof typeof next] === next[key as keyof typeof next]) ? current : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    node.querySelectorAll("button[data-navigation]").forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [active, children]);
  useLayoutEffect(() => { if (target) initialized.current = true; }, [target]);
  return <nav ref={root} className={styles.navigation} aria-label={label}>
    <motion.span className={styles.highlight} aria-hidden="true" initial={false}
      animate={target ? { ...target, opacity: 1 } : { opacity: 0 }}
      transition={reduced || !initialized.current ? { duration: 0 } : motionTokens.spring.smooth} />
    {children}
  </nav>;
}

type SidebarProps = {
  active: CollectionFilter;
  counts: Record<CollectionFilter, number>;
  tags: Array<{ name: string; count: number }>;
  activeTag: string | null;
  onSelect: (filter: CollectionFilter) => void;
  onSelectTag: (tag: string | null) => void;
  draggable?: boolean;
  showBrand?: boolean;
  onRenameTag?: (name: string) => void;
  onRemoveTag?: (name: string) => void;
  pinnedTags?: string[];
  onPinTag?: (name: string, pinned: boolean) => void;
  onSettings?: () => void;
  settingsOpen?: boolean;
  settingsDisabled?: boolean;
};

export function Sidebar({ active, counts, tags, activeTag, onSelect, onSelectTag, draggable = false, showBrand = true, onRenameTag, onRemoveTag, pinnedTags = [], onPinTag, onSettings, settingsOpen, settingsDisabled }: SidebarProps) {
  const { t } = useI18n();
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const reduced = useReducedMotionPreference();
  const pinned = pinnedTags.flatMap(name => {
    const tag = tags.find(tag => tag.name.toLowerCase() === name.toLowerCase());
    return tag ? [tag] : [];
  });
  const tagRows = (rows: typeof tags, isPinnedGroup = false) => rows.map(tag => {
    const isPinned = pinnedTags.some(name => name.toLowerCase() === tag.name.toLowerCase());
    return <DesktopMenu key={`${isPinnedGroup ? 'pinned:' : 'tag:'}${tag.name}`} context label={t('Actions for tag {name}', { name: tag.name })} actions={[
      ...(onPinTag ? [{ label: isPinned ? 'Unpin tag' : 'Pin tag', icon: isPinned ? <PinOff size={16} strokeWidth={1.75} /> : <Pin size={16} strokeWidth={1.75} />, onSelect: () => onPinTag(tag.name, !isPinned) }] : []),
      ...tagEditActions(() => onRenameTag?.(tag.name), () => onRemoveTag?.(tag.name)),
    ]}><div className={styles.navItem} data-active={activeTag === tag.name || undefined}>
      <Button type="button" variant="ghost" className={styles.row} data-navigation={isPinnedGroup ? `tag:${tag.name}` : tag.name} data-pinned-tag={isPinnedGroup || undefined} aria-pressed={activeTag === tag.name} onClick={() => onSelectTag(tag.name)}>
        <span className={styles.rowContent}>{isPinnedGroup ? <Pin size={16} strokeWidth={1.75} aria-hidden="true" /> : <Tag size={16} strokeWidth={1.75} aria-hidden="true" />}
          <span className={styles.label}>{tag.name}</span><span className={styles.count}>{tag.count}</span>
        </span>
      </Button>
    </div></DesktopMenu>;
  });
  return <aside data-arc-ui className={styles.sidebar} inert={settingsDisabled}>
    {showBrand && <div className={`${styles.brand} ${draggable ? "window-titlebar" : ""}`} onPointerDown={event => handleTitlebarDrag(event, draggable)}>
      <BrandIcon className="h-[19px] w-[135px] max-w-full" />
    </div>}
    <NavigationGroup label={t("Collections")} active={settingsOpen ? null : activeTag ? `tag:${activeTag}` : active}>
      {navigation.map(({ id, label, icon: Icon }) => {
        const selected = !settingsOpen && active === id && !activeTag;
        return <div key={id} className={styles.navItem} data-active={selected || undefined}>
          <Button type="button" variant="ghost" className={styles.row} data-navigation={id} aria-pressed={selected}
            onClick={() => { onSelect(id); onSelectTag(null); }}>
            <span className={styles.rowContent}><Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.label}>{t(label)}</span><span className={styles.count}>{counts[id]}</span>
            </span>
          </Button>
        </div>;
      })}
      {onPinTag && tagRows(pinned, true)}
    </NavigationGroup>
    {tags.length > 0 && <section className={styles.tags} aria-label={t("Tags")}>
      <Button type="button" variant="ghost" className={styles.tagHeading} aria-label={`${t('Tags')} (${tags.length})`} aria-expanded={tagsExpanded} aria-controls={tagsExpanded ? 'sidebar-tags' : undefined} onClick={() => setTagsExpanded(value => !value)}>
        <span className={styles.rowContent}><motion.span className={styles.disclosureIcon} animate={{ rotate: tagsExpanded ? 90 : 0 }} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}><ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" /></motion.span>
        <span className={styles.label}>{t("Tags")}</span><span className={styles.count}>{tags.length}</span></span>
      </Button>
      <ScrollArea id="sidebar-tags" hidden={!tagsExpanded} className={styles.sidebarScroll} viewportClassName={styles.sidebarContent} label={t("Tag filters")} fade={24}>
      <div className={styles.tagList}>
        <NavigationGroup label={t("Tag filters")} active={settingsOpen ? null : activeTag}>
          {tagRows(tags)}
        </NavigationGroup>
      </div>
      </ScrollArea>
    </section>}
    {onSettings && <div className={styles.settings} data-active={settingsOpen || undefined}><Button variant="ghost" className={styles.row} onClick={onSettings} disabled={settingsDisabled} aria-pressed={settingsOpen}><span className={styles.rowContent}><Settings size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.label}>{t("Settings")}</span></span></Button></div>}
  </aside>;
}
