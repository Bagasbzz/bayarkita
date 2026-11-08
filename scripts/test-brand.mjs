import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { AGENTS, greetingFor, scheduleAiReply } from '../functions/_lib/ai.js';
import { defaultSettings } from '../functions/_lib/core.js';
import { onRequest as invoiceRequest } from '../functions/api/invoice.js';

const oldBrand = /bayar[\s_-]?kita|fahmi[\s_-]?dev/i;
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

const pages = [];
const assets = new Set();
for (const file of files('public')) {
  assert.ok(!oldBrand.test(file), `Legacy public filename: ${file}`);
  if (!/\.(html|js|css|svg|json|txt)$/.test(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  assert.ok(!oldBrand.test(source), `Legacy public branding: ${file}`);
  if (file.endsWith('.js')) new vm.Script(source, { filename: file });
  if (!file.endsWith('.html')) continue;
  pages.push(file);
  assert.match(source, /Goisiinn/, `Missing brand: ${file}`);
  for (const [, ref] of source.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(?:https?:|mailto:|tel:|data:|\/api\/)/.test(ref)) continue;
    const target = ref.split(/[?#]/)[0];
    const resolved = path.resolve(target.startsWith('/') || source.includes('<base href="/">') ? 'public' : path.dirname(file), target.replace(/^\//, ''));
    assert.ok(fs.existsSync(resolved), `Broken resource ${ref} in ${file}`);
    if (/\.(?:svg|css|js)$/.test(target)) assets.add('/' + path.relative('public', resolved).replaceAll('\\', '/') + (ref.includes('?') ? '?' + ref.split('?')[1] : ''));
    if (/\.(?:css|js)$/.test(target)) assert.match(ref, /\?v=20261108a$/, `Stale script/style version in ${file}`);
  }
  if (!/[\\/](?:admin|inv)[\\/]/.test(file)) {
    const relative = path.relative('public', file).replaceAll('\\', '/');
    const canonical = relative === 'index.html' ? '' : relative.replace(/\.html$/, '');
    assert.ok(source.includes(`rel="canonical" href="https://goisiinn.com/${canonical}"`), `Missing canonical: ${file}`);
  }
  assert.ok(!/mailto:|instagram\.com\/|threads\.com\/@|t\.me\//i.test(source), `Unverified contact published: ${file}`);
}
assert.equal(pages.length, 15);
for (const file of files('functions').filter((file) => file.endsWith('.js'))) {
  assert.ok(!oldBrand.test(fs.readFileSync(file, 'utf8')), `Legacy backend branding: ${file}`);
}
assert.equal(defaultSettings().telegram, '');
assert.match(defaultSettings().quick_replies, /Goisiinn/);
for (const agent of Object.keys(AGENTS)) assert.ok(!oldBrand.test(greetingFor(agent, 'Pelanggan')));

const migration = fs.readFileSync('migrations/010_goisiinn_brand.sql', 'utf8');
const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync('schema.sql', 'utf8'));
const insert = db.prepare('INSERT INTO settings VALUES (?, ?)');
for (const [key, value] of Object.entries(defaultSettings())) insert.run(key, String(value));
db.prepare('UPDATE settings SET svalue = ? WHERE skey = ?').run('Halo BayarKita BAYARKITA Bayarkita bayarkita di bayarkita.site. SOP khusus tetap.', 'quick_replies');
db.prepare('UPDATE settings SET svalue = ? WHERE skey = ?').run('bayarkitaofficial', 'telegram');
const before = db.prepare('SELECT * FROM settings ORDER BY skey').all();
db.exec(migration);
const after = db.prepare('SELECT * FROM settings ORDER BY skey').all();
assert.equal(after.length, before.length);
for (const row of after) {
  if (row.skey === 'quick_replies') {
    assert.ok(!oldBrand.test(row.svalue));
    assert.match(row.svalue, /goisiinn\.com/);
    assert.match(row.svalue, /SOP khusus tetap\./);
  } else if (row.skey === 'telegram') assert.equal(row.svalue, '');
  else assert.equal(row.svalue, before.find((item) => item.skey === row.skey).svalue);
}
db.exec(migration);
assert.deepEqual(db.prepare('SELECT * FROM settings ORDER BY skey').all(), after, 'Migration must be idempotent');
db.prepare('UPDATE settings SET svalue = ? WHERE skey = ?').run('verified_custom_contact', 'telegram');
db.exec(migration);
assert.equal(db.prepare("SELECT svalue FROM settings WHERE skey = 'telegram'").get().svalue, 'verified_custom_contact');
db.close();

const settings = Object.entries(defaultSettings()).map(([skey, svalue]) => ({ skey, svalue: String(svalue) }));
let prompt = '';
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
  const body = JSON.parse(options.body);
  prompt = body.messages[0].content;
  assert.match(body.messages[1].content, /BayarKita/, 'Historical messages are preserved');
  return Response.json({ choices: [{ message: { content: 'Goisiinn siap membantu.' } }] });
};
try {
  const aiDb = {
    prepare(sql) {
      return {
        bind() { return this; },
        async all() {
          if (sql.includes('FROM settings')) return { results: settings };
          if (sql.includes('FROM services')) return { results: [] };
          return { results: [{ sender: 'admin', body: 'Selamat datang di BayarKita.' }] };
        },
        async first() {
          if (sql.includes('FROM conversations')) return { id: 1, ai_enabled: 1, agent: 'Nadira', name: 'Pelanggan' };
          return { sender: 'customer' };
        },
        async run() {},
      };
    },
    async batch() {},
  };
  assert.ok((await scheduleAiReply({ DB: aiDb, AI_API_KEY: 'test' }, 1)).ok);
} finally {
  globalThis.fetch = originalFetch;
}
assert.match(prompt, /Goisiinn/);
assert.match(prompt, /https:\/\/goisiinn\.com/);
assert.match(prompt, /asisten virtual/);
assert.match(prompt, /Konfirmasi Via Chat Web/);
assert.ok(!oldBrand.test(prompt));
assert.ok(!/Telegram @|halo@/.test(prompt));

for (const suffix of ['A1B2C', 'A'.repeat(32)]) {
  const code = `FDV-261105-${suffix}`;
  let lookedUp = '';
  const invoiceDb = {
    prepare() {
      return {
        bind(value) { lookedUp = value; return this; },
        async first() { return { code, status: 'selesai' }; },
      };
    },
  };
  const response = await invoiceRequest({ data: { ctx: {
    db: invoiceDb,
    url: new URL(`https://goisiinn.com/api/invoice?code=${code}&action=status`),
    request: new Request('https://goisiinn.com/api/invoice'),
  } } });
  assert.equal(lookedUp, code);
  assert.deepEqual(await response.json(), { ok: true, confirmed: true, status: 'selesai' });
}
for (const [file, contracts] of [
  ['public/chat.js', ['fdv_chat', 'window.FdvChat', 'FDV-']],
  ['public/script.js', ['window.FdvChat', 'FDV-']],
  ['public/invoice.js', ['FDV-']],
  ['public/admin/admin.js', ['fdv_admin_sound']],
  ['functions/_lib/auth.js', ["const COOKIE = 'fdv_admin'"]],
  ['functions/api/visits.js', ["const COOKIE = 'bk_visitor'"]],
]) {
  const source = fs.readFileSync(file, 'utf8');
  for (const contract of contracts) assert.ok(source.includes(contract), `Lost compatibility contract ${contract} in ${file}`);
}
console.log('brand: 15 pages, resources, AI identity, safe/idempotent migration, and legacy invoice/session contracts passed');

if (process.argv[2]) {
  const base = new URL(process.argv[2]);
  await Promise.all(pages.map(async (file) => {
    const relative = path.relative('public', file).replaceAll('\\', '/');
    const response = await fetch(new URL('/' + relative, base));
    assert.equal(response.status, 200, relative);
    assert.equal((await response.text()).replace(/\r\n/g, '\n'), fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), `Live page differs: ${relative}`);
  }));
  await Promise.all([...assets].map(async (asset) => {
    const response = await fetch(new URL(asset, base));
    assert.equal(response.status, 200, asset);
    const source = fs.readFileSync(path.join('public', asset.split('?')[0].slice(1)), 'utf8');
    assert.equal((await response.text()).replace(/\r\n/g, '\n'), source.replace(/\r\n/g, '\n'), `Live asset differs: ${asset}`);
  }));
  const response = await fetch(new URL('/api/settings', base));
  assert.equal(response.status, 200);
  const liveSettings = await response.json();
  assert.ok(!oldBrand.test(JSON.stringify(liveSettings)), 'Legacy brand in public API');
  console.log('brand: all 15 live pages and referenced SVG/CSS/JS match local source; public settings have no old branding');
}
