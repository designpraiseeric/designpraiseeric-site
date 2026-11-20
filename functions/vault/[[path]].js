// Encrypted files are only read server-side by /brand. Hide them from direct requests.
export const onRequest = () => new Response('Not found', { status: 404 });
