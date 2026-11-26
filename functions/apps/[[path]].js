// The web apps, served on the site's own address. /apps/<app>/… is fetched from where the app is
// hosted (GitHub Pages) and passed through, so the address bar never shows GitHub.

const APPS = {
  'colored-lens': 'https://designpraiseeric.github.io/chroma-encyclopedia/',
  'lukuluku': 'https://designpraiseeric.github.io/lukuluku/',
  'colored-lens-studio': 'https://designpraiseeric.github.io/colored-lens-studio/panel/'
};
// links between the apps point at their new addresses too
const SWAP = [
  ['https://designpraiseeric.github.io/chroma-encyclopedia/', '/apps/colored-lens/'],
  ['https://designpraiseeric.github.io/lukuluku/', '/apps/lukuluku/'],
  ['https://designpraiseeric.github.io/colored-lens-studio/panel/', '/apps/colored-lens-studio/']
];

export async function onRequest({ request, params }) {
  const url = new URL(request.url);
  const parts = params.path || [];
  const app = parts[0];
  if (!APPS[app]) return Response.redirect(url.origin + '/tools/', 302);
  if (parts.length === 1 && !url.pathname.endsWith('/')) return Response.redirect(url.origin + '/apps/' + app + '/' + url.search, 301);

  const rest = parts.slice(1).map(encodeURIComponent).join('/') + (url.pathname.endsWith('/') && parts.length > 1 ? '/' : '');
  const target = APPS[app] + rest + url.search;
  const up = await fetch(target, { method: request.method === 'HEAD' ? 'HEAD' : 'GET', headers: { 'User-Agent': request.headers.get('User-Agent') || 'designpraiseeric-site', Accept: request.headers.get('Accept') || '*/*' }, redirect: 'manual' });

  if (up.status >= 300 && up.status < 400) {
    const loc = up.headers.get('Location') || '';
    const base = new URL(APPS[app]);
    const next = new URL(loc, target);
    if (next.origin === base.origin && next.pathname.startsWith(base.pathname)) return Response.redirect(url.origin + '/apps/' + app + '/' + next.pathname.slice(base.pathname.length) + next.search, up.status);
    return Response.redirect(next.href, up.status);
  }

  const h = new Headers();
  ['Content-Type', 'Cache-Control', 'ETag', 'Last-Modified'].forEach(k => { const v = up.headers.get(k); if (v) h.set(k, v); });
  const type = h.get('Content-Type') || '';
  if (/text\/html|javascript|json|manifest/.test(type)) {
    let body = await up.text();
    for (const [a, b] of SWAP) body = body.split(a).join(b);
    return new Response(body, { status: up.status, headers: h });
  }
  return new Response(up.body, { status: up.status, headers: h });
}
