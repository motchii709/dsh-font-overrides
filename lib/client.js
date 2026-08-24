window.__ModuleLoader__.load({
	id: "dsh-font-overrides",
	factory: () => {
		const exports = {};

		// ── Edit here to change the UI font ─────────────────────────────
		// Any Google Fonts family name. Loaded on demand from fonts.googleapis.com,
		// then applied to the base --dsw-font-family token. You can also change it
		// at runtime without editing this file:
		//   __dshFontOverrides.set("M PLUS 1 Code")   // in the browser DevTools console
		// or persist a per-browser choice:
		//   localStorage.setItem("dsh-font-overrides:family", "Zen Kaku Gothic New")
		const DEFAULT_FAMILY = "Noto Sans JP";
		const FALLBACK_STACK =
			'"Segoe UI Variable Text", "Segoe UI", "Hiragino Kaku Gothic ProN", ' +
			'"Yu Gothic UI", "Meiryo", system-ui, sans-serif';
		const WEIGHTS = "400;500;700";
		// ────────────────────────────────────────────────────────────────

		const PLUGIN_ID = "dsh-font-overrides";
		const STORAGE_KEY = "dsh-font-overrides:family";

		function currentFamily() {
			try {
				return localStorage.getItem(STORAGE_KEY) || DEFAULT_FAMILY;
			} catch {
				return DEFAULT_FAMILY;
			}
		}

		let fontLink = null;
		let styleTag = null;

		function removeTags() {
			fontLink?.remove();
			styleTag?.remove();
			fontLink = null;
			styleTag = null;
		}

		function applyFamily(family) {
			if (typeof document === "undefined") return;
			removeTags();
			if (!family) return;

			// Google Fonts stylesheet (display=swap avoids invisible text while loading).
			fontLink = document.createElement("link");
			fontLink.rel = "stylesheet";
			fontLink.href =
				`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}` +
				`:wght@${WEIGHTS}&display=swap`;
			document.head.append(fontLink);

			// `!important` stays ahead of shell stylesheets inserted after this tag.
			styleTag = document.createElement("style");
			styleTag.dataset.plugin = PLUGIN_ID;
			styleTag.textContent =
				`:root{--dsw-font-family:"${family.replace(/"/g, "")}", ${FALLBACK_STACK} !important;}`;
			document.head.append(styleTag);
		}

		exports.inject = [];

		exports.apply = function apply(ctx) {
			ctx.effect(() => {
				applyFamily(currentFamily());
				// Runtime hook: __dshFontOverrides.set("Family Name") in the console.
				window.__dshFontOverrides = {
					set(family) {
						try {
							localStorage.setItem(STORAGE_KEY, family);
						} catch {}
						applyFamily(family);
					},
					reset() {
						try {
							localStorage.removeItem(STORAGE_KEY);
						} catch {}
						applyFamily(DEFAULT_FAMILY);
					},
					get current() {
						return currentFamily();
					},
				};
				return () => {
					removeTags();
					delete window.__dshFontOverrides;
				};
			}, "font-overrides: google fonts family");
		};

		return exports;
	}
});
