// Serve the invoice shell through Assets without Pages' HTML URL normalization.
export async function onRequestGet({ request, env }) {
  const url = new URL('/inv/', request.url);
  const asset = await env.ASSETS.fetch(new Request(url, request));
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
