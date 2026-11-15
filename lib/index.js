// Host half of the plugin: serves a same-origin Google Fonts catalog for the
// client-side font picker. The public metadata endpoint sends no CORS headers,
// so the browser cannot fetch it directly — the host proxies and slims it.
export const name = 'font-overrides';
export const inject = ['webServer'];

const CATALOG_URL = 'https://fonts.google.com/metadata/fonts';
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

let catalogCache = null;
let catalogAt = 0;

async function buildCatalog() {
	const res = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(15000) });
	if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
	const data = await res.json();
	const list = (data.familyMetadataList ?? []).map((f) => ({
		family: f.family,
		category: f.category ?? '',
		popularity: f.popularity ?? 99999,
	}));
	list.sort((a, b) => a.popularity - b.popularity);
	return list;
}

export function apply(ctx) {
	ctx.effect(() => {
		const disposer = ctx.webServer.register({
			kind: 'exact',
			path: '/dsh-font-overrides/catalog',
			handler: async (req, res) => {
				try {
					if (!catalogCache || Date.now() - catalogAt > CATALOG_TTL_MS) {
						catalogCache = await buildCatalog();
						catalogAt = Date.now();
					}
					res.writeHead(200, {
						'content-type': 'application/json; charset=utf-8',
						'cache-control': 'no-cache',
					});
					res.end(JSON.stringify(catalogCache));
				} catch (error) {
					res.writeHead(502, { 'content-type': 'application/json' });
					res.end(JSON.stringify({ error: String(error?.message ?? error) }));
				}
			},
		});
		return disposer;
	}, 'font-overrides: catalog proxy route');
}
