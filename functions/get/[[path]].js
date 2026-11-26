// Downloads on the site's own address: /get/<app>/<platform> sends the latest release file,
// so visitors never land on GitHub. /get/<app>/info returns the latest version and file sizes as JSON.
// Release lookups are cached for 30 minutes; if GitHub can't be reached, the last known file is used.

const APPS = {
  'colored-lens': { repo: 'chroma-encyclopedia', files: { android: /\.apk$/i }, fallback: { tag: 'v1.0.5', android: 'ColoredLens-1.0.5.apk' } },
  'lukuluku': { repo: 'lukuluku', files: { android: /\.apk$/i }, fallback: { tag: 'v1.0.3', android: 'Lukuluku-1.0.3.apk' } },
  'colored-lens-studio': {
    repo: 'colored-lens-studio',
    files: { mac: /-mac\.pkg$/i, windows: /-win\.exe$/i, premiere: /\.ccx$/i, 'after-effects': /\.zxp$/i },
    fallback: { tag: 'v0.21.1', mac: 'ColoredLensStudio-0.21.1-mac.pkg', windows: 'ColoredLensStudio-0.21.1-win.exe', premiere: 'ColoredLens-Premiere-0.21.1.ccx', 'after-effects': 'ColoredLens-AfterEffects-0.21.1.zxp' }
  }
};
const OWNER = 'designpraiseeric';

async function latest(app, ctx) {
  const a = APPS[app];
  const api = `https://api.github.com/repos/${OWNER}/${a.repo}/releases/latest`;
  const cache = caches.default, key = new Request('https://cache.local/get/' + app);
  let hit = await cache.match(key);
  if (hit) return hit.json();
  let rel = null;
  try {
    const r = await fetch(api, { headers: { 'User-Agent': 'designpraiseeric-site', Accept: 'application/vnd.github+json' } });
    if (r.ok) {
      const j = await r.json();
      rel = { tag: j.tag_name, published: j.published_at, assets: (j.assets || []).map(x => ({ name: x.name, size: x.size, url: x.browser_download_url })) };
    }
  } catch (e) {}
  if (!rel) {
    const f = a.fallback;
    rel = { tag: f.tag, fallback: true, assets: Object.keys(a.files).map(p => ({ name: f[p], size: 0, url: `https://github.com/${OWNER}/${a.repo}/releases/download/${f.tag}/${f[p]}` })) };
  } else {
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(rel), { headers: { 'Cache-Control': 'max-age=1800' } })));
  }
  return rel;
}

export async function onRequest(ctx) {
  const parts = (ctx.params.path || []).filter(Boolean);
  const [app, what] = parts;
  if (!APPS[app]) return Response.redirect(new URL('/tools/', ctx.request.url), 302);
  const rel = await latest(app, ctx);
  const files = APPS[app].files;

  if (what === 'info') {
    const out = { version: (rel.tag || '').replace(/^v/, ''), published: rel.published || null, files: {} };
    for (const p in files) { const f = rel.assets.find(x => files[p].test(x.name)); if (f) out.files[p] = { name: f.name, size: f.size }; }
    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' } });
  }
  const pat = files[what] || (Object.keys(files).length === 1 ? Object.values(files)[0] : null);
  const f = pat && rel.assets.find(x => pat.test(x.name));
  if (!f) return Response.redirect(new URL('/tools/' + app + '/', ctx.request.url), 302);
  return new Response(null, { status: 302, headers: { Location: f.url, 'Cache-Control': 'no-store' } });
}
