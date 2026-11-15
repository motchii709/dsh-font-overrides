window.__ModuleLoader__.load({
	id: "dsh-font-overrides",
	factory: (require) => {
		const exports = {};

		// ── Edit here to change the default UI font ─────────────────────
		// Used only when storage holds no value yet (first run).
		// A picker choice always wins over this line.
		const DEFAULT_FAMILY = "Yomogi";
		const FALLBACK_STACK =
			'"Hiragino Maru Gothic ProN", "Hiragino Maru Gothic Pro", "Yu Gothic UI", ' +
			'"Meiryo", "Segoe UI", system-ui, sans-serif';
		// ────────────────────────────────────────────────────────────────

		const PLUGIN_ID = "dsh-font-overrides";
		const STORAGE_KEY = "dsh-font-overrides:family";
		const CATALOG_PATH = "/dsh-font-overrides/catalog";

		// ── Google Fonts availability / weight discovery ────────────────
		// The css2 endpoint answers 400 when the requested weight axis does
		// not exist for the family, and a 400 rejects the WHOLE stylesheet —
		// so probing with a fixed ":wght@400;500;700" silently killed every
		// single-weight family (Yomogi, hand-writing, display fonts…).
		// Availability is instead discovered through the css2 "text" subset
		// endpoint, which always answers 200 for a live family, and the
		// response's @font-face rules tell us exactly which weights exist.
		const familyInfoCache = new Map(); // family -> { ok, weights: number[] }

		function cssFamilyParam(family) {
			return encodeURIComponent(family).replace(/%20/g, "+");
		}

		async function fetchFamilyInfo(family) {
			const cached = familyInfoCache.get(family);
			if (cached) return cached;
			const url =
				`https://fonts.googleapis.com/css2?family=${cssFamilyParam(family)}` +
				`&text=AaBbCcXxYyZz0123&display=swap`;
			let info = { ok: false, weights: [400] };
			try {
				const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
				if (res.ok) {
					const css = await res.text();
					const weights = [...new Set(
						[...css.matchAll(/font-weight:\s*(\d+)/g)].map((m) => Number(m[1])),
					)].sort((a, b) => a - b);
					if (weights.length) info = { ok: true, weights };
				}
			} catch {
				// Offline / blocked: keep the conservative default so the picker
				// still renders and the row still applies with wght@400.
			}
			familyInfoCache.set(family, info);
			return info;
		}

		// Fallback catalog when the host proxy is unreachable (offline etc.).
		const FALLBACK_CATALOG = [
			"Inter","Roboto","Open Sans","Lato","Montserrat","Oswald","Raleway","Nunito",
			"Playfair Display","Merriweather","Roboto Mono","JetBrains Mono","Fira Code",
			"Source Code Pro","Noto Sans JP","Noto Serif JP","M PLUS 1","M PLUS 2",
			"M PLUS Rounded 1c","M PLUS 1p","M PLUS 1 Code","Zen Kaku Gothic New",
			"Zen Kaku Gothic Antique","Zen Maru Gothic","Zen Old Mincho","Zen Kurenaido",
			"BIZ UDGothic","BIZ UDPGothic","BIZ UDMincho","BIZ PGothic","BIZ PMincho",
			"Kosugi","Kosugi Maru","Sawarabi Gothic","Sawarabi Mincho","Yusei Magic",
			"Mochiy Pop One","Mochiy Pop P One","Kaisei Decol","Kaisei Opti",
			"Hachi Maru Pop","Yomogi","Klee One","Dela Gothic One","RocknRoll One",
			"DotGothic16"
		].map((family, i) => ({
			family,
			category: /Mono|Code/.test(family) ? "Monospace" : /Mincho|Serif|Playfair|Merriweather/.test(family) ? "Serif" : /Pop|Maru|Yomogi|Klee|Hachi/.test(family) ? "Handwriting" : "Sans Serif",
			popularity: i,
		}));

		// Raw read: returns the stored family or null. Used to detect
		// whether an override is currently active.
		function storedFamily() {
			try { return localStorage.getItem(STORAGE_KEY); }
			catch { return null; }
		}

		// Display read: stored value, falling back to DEFAULT_FAMILY for the
		// very first run (no override yet). Use this everywhere we *render*
		// the current font. Do not use it for the `current` API, which must
		// distinguish "override cleared" from "default family".
		function currentFamily() {
			return storedFamily() ?? DEFAULT_FAMILY;
		}

		let fontLink = null;
		let styleTag = null;
		// Monotonic token so a slow apply can never overwrite a newer one.
		let applySeq = 0;

		function removeTags() {
			fontLink?.remove();
			styleTag?.remove();
			fontLink = null;
			styleTag = null;
			// Drop the inline override too, so a locale plugin's stylesheet
			// (e.g. dsh-locale-ja) wins again while no override is active.
			document.documentElement.style.removeProperty("--dsw-font-family");
		}

		function stripQuotes(family) {
			return family.replace(/["\\;}{]/g, "");
		}

		function applyFamilySync(family) {
			removeTags();
			if (!family) return;

			const safe = stripQuotes(family);
			styleTag = document.createElement("style");
			styleTag.dataset.plugin = PLUGIN_ID;
			styleTag.textContent =
				`:root{--dsw-font-family:"${safe}", ${FALLBACK_STACK} !important;}`;
			document.head.append(styleTag);

			// Inline !important beats every stylesheet (locale-ja included), so
			// the chosen font stays consistent in any UI language.
			document.documentElement.style.setProperty(
				"--dsw-font-family",
				`"${safe}", ${FALLBACK_STACK}`,
				"important",
			);
		}

		function applyFamily(family) {
			if (typeof document === "undefined") return;
			const seq = ++applySeq;
			// 1) Effective immediately: the var points at the family, and the
			//    browser falls back to the system stack until the webfont
			//    arrives (display=swap behavior without a failed request).
			applyFamilySync(family);
			if (!family) return;
			// 2) Then load the stylesheet with ONLY the weights the family
			//    actually provides — the previous fixed ":wght@400;500;700"
			//    made Google answer 400 for single-weight families and the
			//    font silently never loaded.
			fetchFamilyInfo(family).then((info) => {
				if (seq !== applySeq) return; // superseded by a newer choice
				if (!info.ok) return;         // offline: keep system fallback
				fontLink = document.createElement("link");
				fontLink.rel = "stylesheet";
				fontLink.href =
					`https://fonts.googleapis.com/css2?family=${cssFamilyParam(family)}` +
					`:wght@${info.weights.join(";")}&display=swap`;
				document.head.append(fontLink);
			});
		}

		// ── Font picker ───────────────────────────────────────────────────
		const PICKER_CSS = `
.dshfo-picker { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; }
.dshfo-picker[hidden] { display: none; }
.dshfo-picker-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.5); }
.dshfo-picker-panel {
	position: relative; display: flex; flex-direction: column;
	width: min(560px, calc(100vw - 24px)); height: min(640px, calc(100dvh - 48px));
	border-radius: 16px; overflow: hidden;
	border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.35));
	background: var(--dsw-alias-bg-base, #1a1a1c);
	color: var(--dsw-alias-label-primary, #f2f2f2);
	box-shadow: var(--dsw-shadow-lv3, 0 12px 48px rgba(0,0,0,.5));
}
.dshfo-picker-header { display: flex; align-items: center; justify-content: space-between; flex: none; min-height: 44px; padding: 10px 16px 6px; }
.dshfo-picker-title { font-size: 15px; font-weight: 600; line-height: 1.4; }
.dshfo-picker-close { width: 30px; height: 30px; border: none; border-radius: 8px; background: transparent; color: inherit; cursor: pointer; font-size: 14px; }
.dshfo-picker-close:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.2)); }
.dshfo-picker-tools { display: flex; flex-direction: column; gap: 10px; flex: none; padding: 0 16px 12px; }
.dshfo-picker-search {
	box-sizing: border-box; width: 100%; padding: 9px 12px; font: inherit; font-size: 14px;
	border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35)); border-radius: 10px;
	background: transparent; color: inherit; outline: none;
}
.dshfo-picker-search:focus { border-color: var(--dsw-static-blue-450, #4d93f8); }
.dshfo-picker-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.dshfo-chip {
	padding: 5px 11px; font: inherit; font-size: 12.5px; cursor: pointer; border-radius: 999px;
	border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
	background: transparent; color: inherit;
}
.dshfo-chip:hover { border-color: var(--dsw-alias-border-l3, rgba(128,128,128,.6)); }
/* Category chips: blue fill when active. */
.dshfo-chip-active { background: var(--dsw-static-blue-500, #3b82f6); border-color: transparent; color: #fff; }
.dshfo-picker-list { flex: 1; min-height: 0; overflow-y: auto; padding: 2px 8px 10px; }
.dshfo-row {
	display: flex; align-items: center; justify-content: flex-start; gap: 12px;
	width: 100%; box-sizing: border-box; padding: 13px 14px; margin: 3px 0;
	border: none; border-radius: 10px; background: transparent; color: inherit;
	cursor: pointer; text-align: left; font-size: 15px; line-height: 1.5;
}
.dshfo-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.15)); }
.dshfo-row-active { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.15)); box-shadow: inset 3px 0 0 var(--dsw-static-blue-450, #4d93f8); }
.dshfo-row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dshfo-row-font, inherit) !important; }
.dshfo-row-active .dshfo-row-name::after {
	content: " ✓"; color: var(--dsw-static-blue-450, #4d93f8); font-weight: 700;
}
.dshfo-row-cat { flex: none; font-size: 11px; color: var(--dsw-alias-label-tertiary, #909090); opacity: .75; }
.dshfo-empty { padding: 28px 16px; text-align: center; font-size: 13px; color: var(--dsw-alias-label-tertiary, #909090); }
.dshfo-picker-footer {
	display: flex; align-items: center; justify-content: space-between; gap: 10px; flex: none;
	min-height: 52px; padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px)); font-size: 12.5px;
	color: var(--dsw-alias-label-secondary, #aaa);
	border-top: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.25));
}
.dshfo-picker-reset {
	padding: 9px 14px; font: inherit; font-size: 12.5px; cursor: pointer; border-radius: 8px;
	min-height: 36px; min-width: 36px;
	border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
	background: transparent; color: inherit;
}
.dshfo-picker-reset:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.2)); }
@media (max-width: 600px) {
	.dshfo-picker-panel { width: 100vw; height: 100dvh; border-radius: 0; }
}
/* ── Font scope: chat message text keeps the override, everything else
   stays on the system font. Scoped through semantic slot anchors — the
   SlotOutlet renders every slot inside <div data-slot="<slot key>">, so
   [data-slot=…] selectors survive CSS-module hash churn across DSH
   releases. conversation.session wraps the whole chat view; the inner
   chat flow is conversation.chat.flow. */
:root {
	--dshfo-system-font: -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text",
		"Segoe UI", "Hiragino Sans", "Yu Gothic UI", Meiryo, system-ui, sans-serif;
}
body, body *:not([data-slot="conversation.session"] *):not(.dshfo-picker):not(.dshfo-picker *) {
	font-family: var(--dshfo-system-font, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", "Hiragino Sans", "Yu Gothic UI", Meiryo, system-ui, sans-serif) !important;
}
/* Inside the picker, the per-row preview sets --dshfo-row-font (inline);
   custom-property indirection keeps it alive under the !important above. */
.dshfo-picker .dshfo-row-name {
	font-family: var(--dshfo-row-font, inherit) !important;
}
[data-slot="conversation.session"] p,
[data-slot="conversation.session"] li,
[data-slot="conversation.session"] blockquote,
[data-slot="conversation.session"] h1,
[data-slot="conversation.session"] h2,
[data-slot="conversation.session"] h3,
[data-slot="conversation.session"] h4,
[data-slot="conversation.session"] [data-slot="conversation.chat.node"] p,
[data-slot="conversation.session"] [data-slot="conversation.chat.node"] li,
[data-slot="conversation.session"] [data-slot="conversation.chat.node"] h1,
[data-slot="conversation.session"] [data-slot="conversation.chat.node"] h2,
[data-slot="conversation.session"] [data-slot="conversation.chat.node"] h3,
[data-slot="conversation.session"] [data-slot="conversation.chat.node"] h4,
[data-slot="conversation.session"] [data-slot="conversation.chat.flow"] {
	font-family: var(--dsw-font-family) !important;
}
/* Code blocks keep a monospace stack regardless of the chosen family. */
[data-slot="conversation.session"] pre,
[data-slot="conversation.session"] code,
[data-slot="conversation.session"] pre *,
[data-slot="conversation.session"] code * {
	font-family: var(--dsw-static-font-code, ui-monospace, "Cascadia Mono", Consolas, monospace) !important;
}
/* Settings section row */
.dshfo-settings-section { width: 100%; }
.dshfo-settings-row {
	display: flex; align-items: center; justify-content: space-between; gap: 12px;
	width: 100%; box-sizing: border-box; padding: 14px 16px; margin: 0;
	min-height: 48px;
	border: none; border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.25));
	background: transparent; color: inherit; font: inherit; font-size: 14px; cursor: pointer; text-align: left;
}
.dshfo-settings-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12)); }
.dshfo-settings-row-value { font-size: 12.5px; color: var(--dsw-alias-label-tertiary, #909090); }
`;
		let pickerEl = null;
		let listEl = null;
		let searchEl = null;
		let footerEl = null;
		let footerStatusEl = null;
		let catalog = null;
		let observer = null;
		const loadedFamilies = new Set();
		const filter = { query: "", category: "all" };
		let debounceTimer = 0;

		function loadFontPreview(family) {
			if (loadedFamilies.has(family)) return;
			loadedFamilies.add(family);
			// No weight axis in preview links: the css2 endpoint then serves
			// every weight the family has, so single-weight families work.
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href =
				`https://fonts.googleapis.com/css2?family=${cssFamilyParam(family)}` +
				`&display=swap`;
			document.head.append(link);
		}

		function ensureCatalog() {
			if (catalog) return Promise.resolve(catalog);
			return fetch(CATALOG_PATH)
				.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
				.then((list) => {
					catalog = list;
					return list;
				})
				.catch(() => {
					catalog = FALLBACK_CATALOG;
					return catalog;
				});
		}

		function filteredCatalog() {
			const q = filter.query.trim().toLowerCase();
			return (catalog ?? []).filter((f) => {
				if (filter.category !== "all" && f.category !== filter.category) return false;
				if (q && !f.family.toLowerCase().includes(q)) return false;
				return true;
			});
		}

		function syncActive() {
			if (!listEl) return;
			const cur = currentFamily();
			for (const row of listEl.querySelectorAll(".dshfo-row")) {
				row.classList.toggle("dshfo-row-active", row.dataset.family === cur);
			}
		}

		function rowFor(entry) {
			const row = document.createElement("button");
			row.type = "button";
			row.className = "dshfo-row";
			row.dataset.family = entry.family;
			if (entry.family === currentFamily()) row.classList.add("dshfo-row-active");
			const name = document.createElement("span");
			name.className = "dshfo-row-name";
			name.textContent = entry.family;
			// Preview in the family itself, via a custom property: the global
			// system-font rule is !important, so a direct inline font-family
			// would lose. Indirection through --dshfo-row-font wins instead.
			const safeFamily = stripQuotes(entry.family);
			name.style.setProperty("--dshfo-row-font", `"${safeFamily}", ${FALLBACK_STACK}`);
			const cat = document.createElement("span");
			cat.className = "dshfo-row-cat";
			// Category repeats on every row (critique: label noise). When a
			// category filter is active the whole list shares it — drop the
			// label there.
			const showCat = filter.category === "all" || entry.category !== filter.category;
			cat.textContent = showCat ? (entry.category || "") : "";
			// Sit the category right next to the name (critique: two-ends
			// layout stretched the eye path across the full row width).
			cat.style.marginLeft = "0";
			row.append(name, cat);
			row.addEventListener("click", () => {
				window.__dshFontOverrides.set(entry.family);
				syncActive();
				if (footerStatusEl) footerStatusEl.textContent = `Current: ${entry.family}`;
			});
			return row;
		}

		function renderList() {
			if (!listEl) return;
			listEl.textContent = "";
			const entries = filteredCatalog();
			if (!entries.length) {
				const empty = document.createElement("div");
				empty.className = "dshfo-empty";
				empty.textContent = "No fonts found";
				listEl.append(empty);
				return;
			}
			const frag = document.createDocumentFragment();
			for (const entry of entries) frag.append(rowFor(entry));
			listEl.append(frag);
			if (observer) observer.disconnect();
			observer = new IntersectionObserver((changes) => {
				for (const change of changes) {
					if (!change.isIntersecting) continue;
					loadFontPreview(change.target.dataset.family);
					observer.unobserve(change.target);
				}
			});
			// Snapshot children before attach — IntersectionObserver callback
			// can unobserve rows while we are still iterating. Only observe
			// actual rows; the empty/loading placeholder is the only other
			// child but the early-return above guarantees listEl is empty
			// by the time we get here, so the class check is just defense.
			for (const row of [...listEl.children]) {
				if (row.classList.contains("dshfo-row")) observer.observe(row);
			}
		}

		// ── Chips ──────────────────────────────────────────────────────────
		// Radio chips: one-of-N within a kind. The old design also had a
		// boolean toggle flavour sharing the same helper; the toggle is gone.
		function makeRadioChip(label, value, kind) {
			const b = document.createElement("button");
			b.type = "button";
			b.className = "dshfo-chip" + (filter[kind] === value ? " dshfo-chip-active" : "");
			b.textContent = label;
			b.dataset.kind = kind;
			b.dataset.value = value;
			b.addEventListener("click", () => {
				filter[kind] = value;
				for (const c of pickerEl.querySelectorAll(`.dshfo-chip[data-kind="${kind}"]`)) {
					c.classList.toggle("dshfo-chip-active", c === b);
				}
				renderList();
			});
			return b;
		}

		function buildPicker() {
			pickerEl = document.createElement("div");
			pickerEl.className = "dshfo-picker";
			pickerEl.hidden = true;

			const backdrop = document.createElement("div");
			backdrop.className = "dshfo-picker-backdrop";
			backdrop.addEventListener("click", () => closePicker());

			const panel = document.createElement("div");
			panel.className = "dshfo-picker-panel";

			const header = document.createElement("div");
			header.className = "dshfo-picker-header";
			const title = document.createElement("span");
			title.className = "dshfo-picker-title";
			title.textContent = "Pick a font";
			const close = document.createElement("button");
			close.type = "button";
			close.className = "dshfo-picker-close";
			close.textContent = "✕";
			close.addEventListener("click", () => closePicker());
			header.append(title, close);

			const tools = document.createElement("div");
			tools.className = "dshfo-picker-tools";
			searchEl = document.createElement("input");
			searchEl.type = "search";
			searchEl.className = "dshfo-picker-search";
			searchEl.placeholder = "Search fonts…";
			searchEl.addEventListener("input", () => {
				filter.query = searchEl.value;
				clearTimeout(debounceTimer);
				debounceTimer = setTimeout(renderList, 150);
			});
			const chips = document.createElement("div");
			chips.className = "dshfo-picker-chips";
			chips.append(
				makeRadioChip("All", "all", "category"),
				makeRadioChip("Sans Serif", "Sans Serif", "category"),
				makeRadioChip("Serif", "Serif", "category"),
				makeRadioChip("Display", "Display", "category"),
				makeRadioChip("Handwriting", "Handwriting", "category"),
				makeRadioChip("Monospace", "Monospace", "category"),
			);
			tools.append(searchEl, chips);

			listEl = document.createElement("div");
			listEl.className = "dshfo-picker-list";

			footerEl = document.createElement("div");
			footerEl.className = "dshfo-picker-footer";
			// Keep direct references so we don't reach for firstChild / childNodes.
			footerStatusEl = document.createElement("span");
			footerStatusEl.className = "dshfo-picker-status";
			footerStatusEl.textContent = `Current: ${currentFamily()}`;
			const reset = document.createElement("button");
			reset.type = "button";
			reset.className = "dshfo-picker-reset";
			reset.textContent = "Reset override";
			reset.addEventListener("click", () => {
				window.__dshFontOverrides.clear();
				footerStatusEl.textContent = "Current: (profile default)";
				syncActive();
			});
			footerEl.append(footerStatusEl, reset);

			panel.append(header, tools, listEl, footerEl);
			pickerEl.append(backdrop, panel);
			document.body.append(pickerEl);
		}

		function openPicker() {
			if (!pickerEl) buildPicker();
			pickerEl.hidden = false;
			if (!catalog) {
				listEl.textContent = "";
				const loading = document.createElement("div");
				loading.className = "dshfo-empty";
				loading.textContent = "Loading…";
				listEl.append(loading);
				ensureCatalog().then(() => renderList());
			} else {
				renderList();
			}
			searchEl?.focus();
		}

		function closePicker() {
			if (pickerEl) pickerEl.hidden = true;
		}

		// ── Settings section (slot-based) ─────────────────────────────────
		function registerSettingsSection(ctx) {
			try {
				if (typeof require !== "function" || !ctx?.slots?.inject) {
					console.warn("[dsh-font-overrides] ctx.slots unavailable; use #dsh-fonts or __dshFontOverrides.openPicker()");
					return;
				}
				const { jsx } = require("react/jsx-runtime");
				const FontSection = () =>
					jsx("div", {
						className: "dshfo-settings-section",
						children: jsx("button", {
							type: "button",
							className: "dshfo-settings-row",
							onClick: () => openPicker(),
							children: [
								jsx("span", {
									key: "label",
									className: "dshfo-settings-row-label",
									children: "Font",
								}),
								jsx("span", {
									key: "value",
									className: "dshfo-settings-row-value",
									children: currentFamily(),
								}),
							],
						}),
					});
				ctx.slots.inject("settings.section", () =>
					ctx.slots.register(
						{
							name: "settings.section",
							id: "font-overrides",
							order: 50,
							label: () => "Font",
							children: {},
						},
						FontSection,
					),
				);
			} catch (error) {
				console.warn("[dsh-font-overrides] settings section unavailable:", error);
			}
		}

		exports.inject = ["slots"];

		exports.apply = function apply(ctx) {
			ctx.effect(() => {
				if (typeof document === "undefined") return undefined;

				applyFamily(currentFamily());

				// Picker / settings-row UI stylesheet.
				const uiStyle = document.createElement("style");
				uiStyle.dataset.plugin = PLUGIN_ID;
				uiStyle.dataset.purpose = "picker-ui";
				uiStyle.textContent = PICKER_CSS;
				document.head.append(uiStyle);

				registerSettingsSection(ctx);

				// Surface localStorage failures (Safari Private / quota /
				// cross-site blocked) so the user knows persistence didn't work.
				function reportStorageError(action, error) {
					console.error(`[dsh-font-overrides] localStorage ${action} failed:`, error);
					if (footerEl) {
						footerEl.dataset.error = "1";
						footerEl.title = `Saving the setting failed: ${error?.message ?? error}`;
						if (footerStatusEl) {
							footerStatusEl.textContent = "⚠ Save failed (may revert on restart)";
						}
					}
				}

				function notifySettingsChange(stored) {
					// The settings-section row shows the current family as plain
					// text. Picker / console actions bypass React, so we patch the
					// value node in place. `null` means "override cleared".
					const value = stored ?? "(default)";
					for (const el of document.querySelectorAll(".dshfo-settings-row-value")) {
						el.textContent = value;
					}
				}

				// Runtime hooks.
				window.__dshFontOverrides = {
					set(family) {
						try {
							localStorage.setItem(STORAGE_KEY, family);
						} catch (error) {
							reportStorageError("setItem", error);
						}
						applyFamily(family);
						notifySettingsChange(family);
					},
					clear() {
						try {
							localStorage.removeItem(STORAGE_KEY);
						} catch (error) {
							reportStorageError("removeItem", error);
						}
						applyFamily("");
						notifySettingsChange(null);
					},
					reset() {
						try {
							localStorage.removeItem(STORAGE_KEY);
						} catch (error) {
							reportStorageError("removeItem", error);
						}
						applyFamily(DEFAULT_FAMILY);
						notifySettingsChange(null);
					},
					get current() {
						// True stored value — `null` when no override is active. Does
						// NOT pretend the default family is set, so callers can tell
						// the difference between "user picked X" and "no choice yet".
						return storedFamily();
					},
					openPicker,
				};

				// Deep link: open the picker directly.
				if (location.hash === "#fonts" || location.hash === "#dsh-fonts") openPicker();

				return () => {
					removeTags();
					uiStyle.remove();
					pickerEl?.remove();
					pickerEl = listEl = searchEl = footerEl = footerStatusEl = null;
					delete window.__dshFontOverrides;
				};
			}, "font-overrides: family override + picker");
		};

		return exports;
	}
});

