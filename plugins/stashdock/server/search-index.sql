-- Shared by Desktop and the MCP server. The index follows stash_items through
-- triggers, so every writer (including other StashDock versions) stays in sync.
-- Trigram matches substrings in every script, including Chinese and Japanese.
CREATE VIRTUAL TABLE IF NOT EXISTS stash_fts USING fts5(id UNINDEXED, title, source, excerpt, tags, content, tokenize='trigram');
CREATE TRIGGER IF NOT EXISTS stash_fts_after_insert AFTER INSERT ON stash_items BEGIN
  DELETE FROM stash_fts WHERE id = NEW.id;
  INSERT INTO stash_fts(id, title, source, excerpt, tags, content) VALUES (NEW.id, NEW.title,
    NEW.source || ' ' || COALESCE(NEW.url, ''), NEW.excerpt, CASE WHEN json_valid(NEW.tags_json) THEN COALESCE((SELECT group_concat(value, ' ') FROM json_each(NEW.tags_json)), '') ELSE NEW.tags_json END,
    CASE WHEN NEW.asset_path IS NOT NULL AND NEW.asset_path != '' THEN COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.context_override, '')
      ELSE COALESCE(NEW.context_override, NEW.content, '') END);
END;
CREATE TRIGGER IF NOT EXISTS stash_fts_after_update AFTER UPDATE OF id, title, source, url, excerpt, tags_json, asset_path, content, context_override ON stash_items BEGIN
  DELETE FROM stash_fts WHERE id = OLD.id;
  INSERT INTO stash_fts(id, title, source, excerpt, tags, content) VALUES (NEW.id, NEW.title,
    NEW.source || ' ' || COALESCE(NEW.url, ''), NEW.excerpt, CASE WHEN json_valid(NEW.tags_json) THEN COALESCE((SELECT group_concat(value, ' ') FROM json_each(NEW.tags_json)), '') ELSE NEW.tags_json END,
    CASE WHEN NEW.asset_path IS NOT NULL AND NEW.asset_path != '' THEN COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.context_override, '')
      ELSE COALESCE(NEW.context_override, NEW.content, '') END);
END;
CREATE TRIGGER IF NOT EXISTS stash_fts_after_delete AFTER DELETE ON stash_items BEGIN
  DELETE FROM stash_fts WHERE id = OLD.id;
END;
-- rebuild
DELETE FROM stash_fts;
INSERT INTO stash_fts(id, title, source, excerpt, tags, content)
  SELECT id, title, source || ' ' || COALESCE(url, ''), excerpt, CASE WHEN json_valid(tags_json) THEN COALESCE((SELECT group_concat(value, ' ') FROM json_each(tags_json)), '') ELSE tags_json END,
    CASE WHEN asset_path IS NOT NULL AND asset_path != '' THEN COALESCE(content, '') || ' ' || COALESCE(context_override, '')
      ELSE COALESCE(context_override, content, '') END
  FROM stash_items;
