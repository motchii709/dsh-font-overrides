# dsh-font-overrides

Change the DeepSeek Harness (DSH) Web UI font by **Google Fonts family name** —
a minimal, zero-dependency standard DSH client plugin.

日本語のREADMEは [こちら](README.ja.md)。

## Features

- **Font picker UI** (Google Fonts style) — searchable list of every Google
  Fonts family, filterable by category (sans / serif / display / handwriting /
  monospace). Each row previews in its own font.
  Open it from **Settings → Font**, the `#fonts` URL hash, or the console.
- **Per-family weight discovery** — the plugin probes which weights a family
  actually provides before loading its stylesheet, so single-weight families
  (handwriting / display fonts like *Yomogi*, *Hachi Maru Pop*, *Dela Gothic
  One*…) apply correctly instead of failing silently.
- **Chat-scoped override** — the chosen font applies to conversation message
  text only. The rest of the shell (sidebar, composer, settings, stats) keeps
  the system font, so UI alignment and line heights never break.
- **Monospace protection** — `pre`/`code` inside the chat keeps a monospace
  stack regardless of the chosen family.
- **Persistent choice** — the picked family is stored in `localStorage` and
  re-applied on every page load.
- **Live catalog** — the host half proxies `fonts.google.com/metadata/fonts`
  same-origin (the public endpoint sends no CORS headers) with a 24 h cache;
  a built-in fallback catalog covers offline use.

## Install

```bash
dsh plugin --profile web add <path to this folder>
dsh web
```

Or add it to the web profile's `package.json` by hand:

```json
{
  "dependencies": {
    "dsh-font-overrides": "link:C:/path/to/dsh-font-overrides"
  },
  "dsh": {
    "profile": {
      "bundles": ["dsh-font-overrides"]
    }
  }
}
```

Uninstall:

```bash
dsh plugin --profile web remove dsh-font-overrides
```

## Usage

### Picker UI

1. Open Settings and click the **フォント** row, or visit the app with
   `#fonts` appended to the URL.
2. Search, filter, click a family. The change is instant and persistent.
3. **オーバーライド解除** resets to the profile default font.

### Console (quick, also persisted)

```js
__dshFontOverrides.set("M PLUS 1 Code") // apply + persist
__dshFontOverrides.current              // inspect (null = no override)
__dshFontOverrides.openPicker()         // open the picker
__dshFontOverrides.clear()              // back to profile default
```

### Default family (file edit, applies to fresh profiles)

Edit one line at the top of `lib/client.js`:

```js
const DEFAULT_FAMILY = "Noto Sans JP"; // ← any Google Fonts name
```

## How it works

- **Host half** (`lib/index.js`) registers one exact webserver route,
  `/dsh-font-overrides/catalog`, which fetches and slims Google's font
  metadata (family, category, popularity) with a 24 h cache.
- **Client half** (`lib/client.js`) is the plugin body:
  - discovers the family's available weights via the css2 `text=` subset
    endpoint (always `200` for a live family), then loads
    `css2?family=…:wght@<weights>&display=swap`;
  - overrides the `--dsw-font-family` token via an injected `<style>` tag
    **and** an inline `!important` property on `<html>`, beating locale
    plugins' stylesheets in any UI language;
  - scopes the override to chat text through the semantic slot anchors the
    renderer emits (`[data-slot="conversation.session"]`,
    `conversation.chat.flow`, `conversation.chat.node`) — stable across DSH
    releases because they don't depend on hashed CSS-module class names;
  - registers the settings row through the `settings.section` slot;
  - everything runs inside one `ctx.effect`, so teardown fully restores the
    original state (tags removed, var dropped, hooks deleted).
- A Windows-Japanese fallback stack rides along, so the UI never falls apart
  even if the webfont fails to load.

## Compatibility

| DSH version | Status |
|---|---|
| 0.2.x (`0.2.1-rc.5` verified) | ✅ |
| 0.1.x | likely works (slot keys unchanged); picker verified on 0.2.x |

## License

MIT
