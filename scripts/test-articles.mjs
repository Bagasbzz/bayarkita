import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const html = fs.readFileSync('public/artikel.html', 'utf8');
const cards = [...html.matchAll(/<article class="article-card">([\s\S]*?)<\/article>/g)];
const guides = [...html.matchAll(/<details class="article-guide" id="([^"]+)">/g)].map((m) => m[1]);
assert.equal(cards.length, 6);
assert.equal(new Set(guides).size, 6);
for (const [, source] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^(?:https?:|mailto:)/.test(source)) continue;
  const file = source.split(/[?#]/)[0];
  assert.ok(fs.existsSync(path.join('public', file)), `Missing local resource: ${file}`);
}
for (const [, card] of cards) {
  const links = [...card.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(links.length, 3);
  assert.equal(new Set(links).size, 1);
  assert.ok(guides.includes(links[0].slice(1)));
  assert.match(card.match(/<p>(.*?)<\/p>/)[1], /\.$/);
  const src = card.match(/src="([^"]+)"/)[1];
  assert.ok(fs.existsSync(path.join('public', src)), `Missing thumbnail: ${src}`);
  assert.match(src, /^assets\/articles\/[a-z0-9-]+-guide-goisiinn\.svg$/);
  const svg = fs.readFileSync(path.join('public', src), 'utf8');
  assert.match(svg, /viewBox="0 0 1200 675"/);
  assert.match(svg, /<title id="title">[^<]+<\/title>/);
  assert.match(svg, /<desc id="desc">[^<]+<\/desc>/);
  assert.ok(!/bayar.?kita|fahmidev|<script|<foreignObject|\bon\w+=|(?:href|src)=/i.test(svg), `Unsafe or old thumbnail content: ${src}`);
  assert.match(svg, /goisiinn/i);
}
assert.ok(/src="articles\.js\?v=20261109a" defer/.test(html), 'Article navigation script must be loaded');
const elements = Object.fromEntries(guides.map((id) => [id, {
  open: false,
  matches: (selector) => selector === 'details.article-guide',
}]));
const listeners = {};
const location = { hash: `#${guides[0]}` };
vm.runInNewContext(fs.readFileSync('public/articles.js', 'utf8'), {
  document: {
    getElementById: (id) => elements[id],
    addEventListener: (type, callback) => { listeners[type] = callback; },
  },
  window: { addEventListener: (type, callback) => { listeners[type] = callback; } },
  location,
});
assert.ok(elements[guides[0]].open, 'Direct guide URL must expand the guide');
listeners.click({ target: { closest: () => ({ getAttribute: () => `#${guides[1]}` }) } });
assert.ok(elements[guides[1]].open, 'Card click must expand the guide');
location.hash = `#${guides[2]}`;
listeners.hashchange();
assert.ok(elements[guides[2]].open, 'Hash navigation must expand the guide');
location.hash = '#missing';
listeners.hashchange();
console.log('articles: 6 thumbnails, 18 links, 6 guides, and guide navigation passed');

if (process.argv[2]) {
  const base = new URL(process.argv[2]);
  const response = await fetch(new URL('/artikel.html', base));
  assert.equal(response.status, 200);
  const liveHtml = await response.text();
  assert.equal(liveHtml.replace(/\r\n/g, '\n'), html.replace(/\r\n/g, '\n'), 'Live article HTML must match local content');
  const resources = [
    ...cards.map(([, card]) => card.match(/src="([^"]+)"/)[1]),
    'articles.js?v=20261109a',
    'styles.css?v=20261109a',
  ];
  await Promise.all(resources.map(async (resource) => {
    const asset = await fetch(new URL(resource, base), { method: 'HEAD' });
    assert.equal(asset.status, 200, `Live resource unavailable: ${resource}`);
    if (/\.(?:png|svg)$/.test(resource)) assert.match(asset.headers.get('content-type'), /^image\//);
    if (resource.endsWith('.svg')) {
      assert.match(asset.headers.get('content-type'), /^image\/svg\+xml/);
      const response = await fetch(new URL(resource, base));
      assert.equal(await response.text(), fs.readFileSync(path.join('public', resource), 'utf8'), `Live thumbnail differs: ${resource}`);
    }
  }));
  console.log('articles: live HTML matches; 6 thumbnails, CSS, and JavaScript return HTTP 200');
}
