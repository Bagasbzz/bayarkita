import { json, now, parseLocal, readCookie, today } from '../_lib/core.js';
import { randomHex } from '../_lib/password.js';

const COOKIE = 'bk_visitor';
const VISIT_SECONDS = 30 * 60;
const VISITOR_DAYS = 365;
const ID_PATTERN = /^[a-f0-9]{32}$/;
let lastCleanupDay = '';

function cookieHeader(url, value, maxAge) {
  const attrs = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (url.protocol === 'https:') attrs.push('Secure');
  return attrs.join('; ');
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ ok: false }, 405, { Allow: 'POST' });

  const url = new URL(request.url);
  const stamp = now();
  const day = today();
  const priorId = readCookie(request, COOKIE);
  const visitorId = ID_PATTERN.test(priorId) ? priorId : randomHex(16);
  const visitor = await env.DB.prepare('SELECT last_seen_at FROM analytics_visitors WHERE visitor_id = ?')
    .bind(visitorId).first();
  const isNew = !visitor;
  const recent = visitor && Date.now() - parseLocal(visitor.last_seen_at) < VISIT_SECONDS * 1000;

  if (!recent) {
    const column = isNew ? 'new_visits' : 'returning_visits';
    await env.DB.prepare(`INSERT INTO analytics_daily (visit_date, visits, ${column}) VALUES (?, 1, 1)
      ON CONFLICT(visit_date) DO UPDATE SET visits = visits + 1, ${column} = ${column} + 1`)
      .bind(day).run();
  }

  await env.DB.prepare(`INSERT INTO analytics_visitors (visitor_id, first_seen_at, last_seen_at) VALUES (?, ?, ?)
    ON CONFLICT(visitor_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`)
    .bind(visitorId, stamp, stamp).run();
  if (lastCleanupDay !== day) {
    lastCleanupDay = day;
    await env.DB.prepare('DELETE FROM analytics_daily WHERE visit_date < ?').bind(new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)).run();
    await env.DB.prepare('DELETE FROM analytics_visitors WHERE last_seen_at < ?').bind(new Date(Date.now() - VISITOR_DAYS * 86400000).toISOString().slice(0, 10) + ' 00:00:00').run();
  }

  const headers = { 'Set-Cookie': cookieHeader(url, visitorId, VISITOR_DAYS * 86400) };
  return json({ ok: true }, 200, headers);
}
