<!-- TOOLREPAIR-START -->
<!-- Auto-managed by ahmad-awais-deepseek-v4-toolrepair. Do not edit manually. -->
<!-- Installed: TIMESTAMP. Verify: npx ahmad-awais-deepseek-v4-toolrepair verify -->

## DeepSeek Tool-Calling Rules

When generating tool calls, follow these rules to avoid format errors:

### Shape rules
1. Omit optional fields — never send `null` for an optional field
2. Arrays must be actual JSON arrays (`["a","b"]`), never JSON-encoded strings (`'["a","b"]'`)
3. When a single value is passed to an array-typed field, wrap it: `"foo"` → `["foo"]`
4. When a single object is passed to an array-typed field, wrap it: `{}` → `[{}]`

### Path formatting
5. File paths must be plain absolute paths: `/Users/x/proj/notes.md`
6. NEVER format paths as markdown autolinks: `[notes.md](http://notes.md)` is WRONG

### Relational invariants
7. read_file: if you provide `offset`, you MUST also provide `limit` (and vice versa)
   - If you only know `limit`, add `offset: 0`
   - If you only know `offset`, add `limit: 2000`

<!-- TOOLREPAIR-END -->
