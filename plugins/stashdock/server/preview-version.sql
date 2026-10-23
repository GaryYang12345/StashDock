-- Counts cover changes, so the desktop shelf versions cover URLs without
-- reading the images (library.rs SHELF_COLUMNS). Both hosts run this after
-- adding the preview_version column; every cover write passes through it.
CREATE TRIGGER IF NOT EXISTS stash_items_preview_version AFTER UPDATE OF preview ON stash_items
WHEN NEW.preview IS NOT OLD.preview
BEGIN
  UPDATE stash_items SET preview_version = OLD.preview_version + 1 WHERE rowid = NEW.rowid;
END;
