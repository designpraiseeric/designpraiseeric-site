// Serves /media/* with byte-range support.
// Pages' static hosting ignores Range headers, so browsers can't seek in a video
// (Safari may refuse to play it at all). This passes each request to the static
// file and, when the browser asks for part of it, answers 206 with just that slice.
// If the videos move to R2 later, R2 handles ranges itself and this can go.

const TYPES = { mp4: 'video/mp4', webm: 'video/webm', vtt: 'text/vtt; charset=utf-8', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const url = new URL(request.url);
  const asset = await env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
  if (!asset.ok) return asset;

  const ext = url.pathname.split('.').pop().toLowerCase();
  const headers = new Headers(asset.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=2592000');
  headers.set('Access-Control-Allow-Origin', '*');
  if (TYPES[ext]) headers.set('Content-Type', TYPES[ext]);
  headers.delete('Content-Encoding');

  const range = request.headers.get('Range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || (m[1] === '' && m[2] === '')) {
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
    return new Response(asset.body, { status: 200, headers });
  }

  const body = await asset.arrayBuffer();
  const size = body.byteLength;
  let start, end;
  if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; } // suffix: last N bytes
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start >= size || start > end) {
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(request.method === 'HEAD' ? null : body.slice(start, end + 1), { status: 206, headers });
}
