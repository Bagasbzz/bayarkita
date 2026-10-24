/**
 * Sesi admin: cookie `fdv_admin` berisi token acak; hash SHA-256-nya disimpan
 * di tabel admin_sessions. Masa berlaku 7 hari.
 */
import { fail, now, fmtLocal, secondsAgo } from './core.js';
import { sha256Hex, randomHex } from './password.js';

const COOKIE = 'fdv_admin';
const SESSION_DAYS = 7;
const LOGIN_MAX_FAILS = 8;
const LOGIN_WINDOW_SEC = 600;

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

const isHttps = (url) => url.protocol === 'https:';

function cookieHeader(url, value, maxAge) {
  const attrs = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (isHttps(url)) attrs.push('Secure');
  return { 'Set-Cookie': attrs.join('; ') };
}

export async function createSession(ctx, adminId) {
  const token = randomHex(32);
  const hash = await sha256Hex(token);
  const exp = fmtLocal(new Date(Date.now() + SESSION_DAYS * 86400000));
  await ctx.db.prepare('INSERT INTO admin_sessions (token_hash, admin_id, created_at, expires_at) VALUES (?,?,?,?)')
    .bind(hash, adminId, now(), exp).run();
  // Bersihkan sesi kedaluwarsa secara oportunistik.
  await ctx.db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').bind(now()).run();
  return cookieHeader(ctx.url, token, SESSION_DAYS * 86400);
}

export async function destroySession(ctx) {
  const token = readCookie(ctx.request, COOKIE);
  if (token) await ctx.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return cookieHeader(ctx.url, '', 0);
}

/** Admin yang sedang login, atau null. */
export async function currentAdmin(ctx) {
  const token = readCookie(ctx.request, COOKIE);
  if (!token) return null;
  const row = await ctx.db.prepare(
    'SELECT a.id, a.username FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ? AND s.expires_at > ?'
  ).bind(await sha256Hex(token), now()).first();
  return row || null;
}

export async function requireAdmin(ctx) {
  const admin = await currentAdmin(ctx);
  if (!admin) fail('Silakan login terlebih dahulu.', 401);
  // Proteksi CSRF sederhana: permintaan tulis harus datang dari fetch() front-end sendiri.
  if (ctx.request.method === 'POST' && ctx.request.headers.get('X-Requested-With') !== 'fetch') fail('Permintaan ditolak.', 403);
  return admin;
}

// ---------- Rate limit login per IP ----------
export const clientIp = (request) => request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'local';

export async function assertLoginAllowed(ctx) {
  const ip = clientIp(ctx.request);
  const since = secondsAgo(LOGIN_WINDOW_SEC);
  const c = await ctx.db.prepare('SELECT COUNT(*) AS c FROM login_attempts WHERE ip = ? AND attempted_at > ?').bind(ip, since).first('c');
  if (Number(c) >= LOGIN_MAX_FAILS) fail('Terlalu banyak percobaan. Coba lagi 10 menit.', 429);
}

export async function recordLoginFail(ctx) {
  const ip = clientIp(ctx.request);
  await ctx.db.batch([
    ctx.db.prepare('INSERT INTO login_attempts (ip, attempted_at) VALUES (?,?)').bind(ip, now()),
    ctx.db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(secondsAgo(LOGIN_WINDOW_SEC)),
  ]);
}

export async function clearLoginFails(ctx) {
  await ctx.db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(clientIp(ctx.request)).run();
}
