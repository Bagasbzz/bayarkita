/**
 * API admin (butuh sesi login). Semua aksi lewat ?action=...
 * Auth      : login, logout, me
 * Dashboard : stats
 * Chat      : conversations, messages, reply, conv_status, conv_delete
 * Pesanan   : orders, order_status, order_note, order_delete, export_orders (CSV)
 * Katalog   : services, service_save, service_toggle, service_delete, service_sort
 * Setting   : settings, settings_save, password
 */
import {
  ok, fail, param, strParam, requirePost, now, today, daysAgo, setSetting, settingsAll, defaultSettings,
  addMessage, messagesSince, parseJsonArr,
} from '../_lib/core.js';
import { hashPassword, verifyPassword } from '../_lib/password.js';
import { complete, scheduleAiReply } from '../_lib/ai.js';
import {
  createSession, destroySession, currentAdmin, requireAdmin, assertLoginAllowed, recordLoginFail, clearLoginFails,
} from '../_lib/auth.js';

const ORDER_STATUSES = ['baru', 'diproses', 'selesai', 'batal'];
const STATUS_LABELS = { baru: 'Baru', diproses: 'Diproses', selesai: 'Selesai', batal: 'Dibatalkan' };
const NUMERIC_SETTINGS = ['fee_idr_base', 'fee_idr_pct', 'fee_usd_min', 'fee_usd_min_threshold', 'fee_usd_base', 'fee_usd_pct', 'min_order_idr', 'min_order_usd', 'ai_enabled', 'ai_delay_min', 'ai_delay_max', 'ai_queue_min', 'ai_queue_max'];

const q = (url, key, def = '') => url.searchParams.get(key) ?? def;
const intParam = (ctx, key) => parseInt(param(ctx, key, 0), 10) || 0;
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export async function onRequest({ data, env }) {
  const ctx = data.ctx;
  const { db, url } = ctx;
  const action = q(url, 'action') || param(ctx, 'action', '');

  // ---------- Auth ----------
  if (action === 'login') {
    requirePost(ctx);
    await assertLoginAllowed(ctx);
    const u = strParam(ctx, 'username', 64);
    const p = String(param(ctx, 'password', ''));
    const row = await db.prepare('SELECT id, username, password_hash FROM admins WHERE username = ?').bind(u).first();
    if (!row || !(await verifyPassword(p, row.password_hash))) {
      await recordLoginFail(ctx);
      fail('Username atau password salah.', 401);
    }
    await clearLoginFails(ctx);
    const cookie = await createSession(ctx, row.id);
    return ok({ admin: { id: Number(row.id), username: row.username } }, cookie);
  }
  if (action === 'logout') {
    return ok({}, await destroySession(ctx));
  }
  if (action === 'me') {
    const admin = await currentAdmin(ctx);
    if (!admin) fail('Belum login.', 401);
    return ok({ admin });
  }

  const admin = await requireAdmin(ctx);
  await setSetting(db, 'admin_last_seen', now()); // dipakai widget untuk indikator "admin online"

  switch (action) {
    // ---------- Dashboard ----------
    case 'stats': {
      const t0 = today() + ' 00:00:00';
      const m0 = today().slice(0, 8) + '01 00:00:00';
      const one = async (sql, ...p) => db.prepare(sql).bind(...p).first('v');
      const byStatus = (await db.prepare('SELECT status, COUNT(*) c, COALESCE(SUM(total),0) t, COALESCE(SUM(fee),0) f FROM orders GROUP BY status').all()).results;
      const recent = (await db.prepare('SELECT id, code, service_name, plan, customer_name, phone, total, currency, amount, status, created_at FROM orders ORDER BY id DESC LIMIT 8').all()).results;
      // Omzet 14 hari terakhir (pesanan selesai + diproses)
      const daily = {};
      for (let i = 13; i >= 0; i--) daily[daysAgo(i)] = { total: 0, fee: 0, count: 0 };
      const rows = (await db.prepare("SELECT created_at, total, fee FROM orders WHERE status IN ('diproses','selesai') AND created_at >= ?").bind(daysAgo(13) + ' 00:00:00').all()).results;
      for (const r of rows) {
        const d = String(r.created_at).slice(0, 10);
        if (daily[d]) { daily[d].total += Number(r.total); daily[d].fee += Number(r.fee); daily[d].count++; }
      }
      const top = (await db.prepare('SELECT service_name, COUNT(*) c, COALESCE(SUM(total),0) t FROM orders GROUP BY service_name ORDER BY c DESC LIMIT 6').all()).results;
      return ok({
        orders_today: Number(await one('SELECT COUNT(*) v FROM orders WHERE created_at >= ?', t0)),
        orders_month: Number(await one('SELECT COUNT(*) v FROM orders WHERE created_at >= ?', m0)),
        orders_new: Number(await one("SELECT COUNT(*) v FROM orders WHERE status = 'baru'")),
        orders_processing: Number(await one("SELECT COUNT(*) v FROM orders WHERE status = 'diproses'")),
        revenue_month: Number(await one("SELECT COALESCE(SUM(total),0) v FROM orders WHERE status = 'selesai' AND created_at >= ?", m0)),
        fee_month: Number(await one("SELECT COALESCE(SUM(fee),0) v FROM orders WHERE status = 'selesai' AND created_at >= ?", m0)),
        unread_chats: Number(await one('SELECT COUNT(*) v FROM conversations WHERE unread_admin > 0')),
        open_chats: Number(await one("SELECT COUNT(*) v FROM conversations WHERE status = 'open'")),
        total_customers: Number(await one('SELECT COUNT(*) v FROM conversations')),
        by_status: byStatus, recent_orders: recent, daily, top_services: top,
      });
    }

    // ---------- Chat ----------
    case 'conversations': {
      const filter = q(url, 'filter', 'all');
      const qs = q(url, 'q').trim();
      const where = []; const p = [];
      if (filter === 'unread') where.push('c.unread_admin > 0');
      else if (filter === 'open') where.push("c.status = 'open'");
      else if (filter === 'closed') where.push("c.status = 'closed'");
      if (qs) { where.push('(c.name LIKE ? OR c.phone LIKE ? OR c.last_message LIKE ?)'); p.push(`%${qs}%`, `%${qs}%`, `%${qs}%`); }
      const sql = `SELECT c.id, c.name, c.phone, c.status, c.unread_admin, c.last_message, c.last_sender, c.last_at, c.created_at, c.agent, c.ai_enabled,
        (SELECT COUNT(*) FROM orders o WHERE o.conversation_id = c.id) AS order_count
        FROM conversations c${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(c.last_at, c.created_at) DESC LIMIT 200`;
      const rows = (await db.prepare(sql).bind(...p).all()).results.map((r) => ({ ...r, id: Number(r.id), unread_admin: Number(r.unread_admin), order_count: Number(r.order_count) }));
      const totalUnread = await db.prepare('SELECT COUNT(*) v FROM conversations WHERE unread_admin > 0').first('v');
      return ok({ conversations: rows, total_unread: Number(totalUnread) });
    }

    case 'messages': {
      const id = parseInt(q(url, 'id', '0'), 10) || 0;
      const since = parseInt(q(url, 'since', '0'), 10) || 0;
      const conv = await db.prepare('SELECT id, name, phone, status, created_at, agent, ai_enabled FROM conversations WHERE id = ?').bind(id).first();
      if (!conv) fail('Percakapan tidak ditemukan.', 404);
      const msgs = await messagesSince(db, id, since, 500);
      if (since === 0 || msgs.length) await db.prepare('UPDATE conversations SET unread_admin = 0 WHERE id = ?').bind(id).run();
      const orders = (await db.prepare('SELECT id, code, service_name, plan, amount, currency, fee, total, status, created_at FROM orders WHERE conversation_id = ? ORDER BY id DESC').bind(id).all()).results;
      return ok({ conversation: conv, messages: msgs, orders });
    }

    case 'reply': {
      const id = intParam(ctx, 'id');
      const body = strParam(ctx, 'body', 4000);
      if (!body) fail('Pesan kosong.');
      if (!(await db.prepare('SELECT id FROM conversations WHERE id = ?').bind(id).first())) fail('Percakapan tidak ditemukan.', 404);
      // Admin manusia membalas = ambil alih: matikan AI di percakapan ini dan buang balasan AI yang masih antre.
      await db.prepare("DELETE FROM messages WHERE conversation_id = ? AND sender = 'admin' AND visible_at > ?").bind(id, now()).run();
      const mid = await addMessage(db, id, 'admin', body, { human: true });
      await db.prepare('UPDATE conversations SET unread_admin = 0, ai_enabled = 0 WHERE id = ?').bind(id).run();
      return ok({ id: mid, created_at: now() });
    }

    case 'conv_ai': {
      const on = param(ctx, 'enabled', 1) ? 1 : 0;
      await db.prepare('UPDATE conversations SET ai_enabled = ? WHERE id = ?').bind(on, intParam(ctx, 'id')).run();
      return ok();
    }

    case 'ai_test': {
      // Diagnosa koneksi gateway AI (sinkron). Opsional: id percakapan untuk memaksa balasan sekarang.
      if (!env.AI_API_KEY) fail('Secret AI_API_KEY belum diset.');
      const t0 = Date.now();
      try {
        const convId = Number(param(ctx, 'id', 0));
        if (convId) { const r = await scheduleAiReply(env, convId); return ok({ ms: Date.now() - t0, result: r }); }
        const reply = await complete(env, [{ role: 'user', content: 'Balas satu kata: OK' }]);
        return ok({ ms: Date.now() - t0, model: env.AI_MODEL, base: env.AI_BASE_URL, reply });
      } catch (e) { fail(`Gagal: ${e.message} (${Date.now() - t0} ms)`, 502); }
    }

    case 'conv_status': {
      const status = strParam(ctx, 'status', 12);
      if (!['open', 'closed'].includes(status)) fail('Status tidak valid.');
      await db.prepare('UPDATE conversations SET status = ? WHERE id = ?').bind(status, intParam(ctx, 'id')).run();
      return ok();
    }

    case 'conv_delete': {
      const id = intParam(ctx, 'id');
      await db.batch([
        db.prepare('DELETE FROM messages WHERE conversation_id = ?').bind(id),
        db.prepare('DELETE FROM orders WHERE conversation_id = ?').bind(id),
        db.prepare('DELETE FROM conversations WHERE id = ?').bind(id),
      ]);
      return ok();
    }

    // ---------- Pesanan ----------
    case 'orders': {
      const status = q(url, 'status');
      const qs = q(url, 'q').trim();
      const page = Math.max(1, parseInt(q(url, 'page', '1'), 10) || 1);
      const per = 25;
      const where = []; const p = [];
      if (ORDER_STATUSES.includes(status)) { where.push('status = ?'); p.push(status); }
      if (qs) { where.push('(code LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR service_name LIKE ?)'); p.push(`%${qs}%`, `%${qs}%`, `%${qs}%`, `%${qs}%`); }
      const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
      const total = Number(await db.prepare(`SELECT COUNT(*) v FROM orders${w}`).bind(...p).first('v'));
      const rows = (await db.prepare(`SELECT * FROM orders${w} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...p, per, (page - 1) * per).all()).results;
      return ok({ orders: rows, total, page, pages: Math.max(1, Math.ceil(total / per)) });
    }

    case 'order_status': {
      const id = intParam(ctx, 'id');
      const status = strParam(ctx, 'status', 12);
      const note = strParam(ctx, 'message', 1000);
      if (!ORDER_STATUSES.includes(status)) fail('Status tidak valid.');
      const o = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
      if (!o) fail('Pesanan tidak ditemukan.', 404);
      await db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').bind(status, now(), id).run();
      if (o.status !== status) {
        const text = `Status pesanan #${o.code} diperbarui menjadi: ${STATUS_LABELS[status]}.` + (note ? `\n${note}` : '');
        await addMessage(db, Number(o.conversation_id), 'system', text, { type: 'status', order_id: id, code: o.code, status });
      } else if (note) {
        await addMessage(db, Number(o.conversation_id), 'admin', note);
      }
      return ok();
    }

    case 'order_note': {
      await db.prepare('UPDATE orders SET note = ?, updated_at = ? WHERE id = ?').bind(strParam(ctx, 'note', 2000), now(), intParam(ctx, 'id')).run();
      return ok();
    }

    case 'order_delete': {
      await db.prepare('DELETE FROM orders WHERE id = ?').bind(intParam(ctx, 'id')).run();
      return ok();
    }

    case 'export_orders': {
      const rows = (await db.prepare('SELECT * FROM orders ORDER BY id DESC').all()).results;
      const head = ['Kode', 'Tanggal', 'Pelanggan', 'WhatsApp', 'Layanan', 'Paket', 'Jumlah', 'Mata Uang', 'Kurs', 'Nominal IDR', 'Fee', 'Total', 'Status', 'Catatan'];
      const lines = [head.map(csvCell).join(',')];
      for (const o of rows) {
        lines.push([o.code, o.created_at, o.customer_name, o.phone, o.service_name, o.plan, o.amount, o.currency, o.rate, o.amount_idr, o.fee, o.total, o.status, o.note].map(csvCell).join(','));
      }
      const stamp = now().replace(/[-:]/g, '').replace(' ', '-');
      return new Response('\uFEFF' + lines.join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="pesanan-${stamp}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ---------- Katalog layanan ----------
    case 'services': {
      const rows = (await db.prepare('SELECT * FROM services ORDER BY sort_order, id').all()).results
        .map((r) => ({ ...r, id: Number(r.id), active: Number(r.active), currencies: parseJsonArr(r.currencies), presets: parseJsonArr(r.presets) }));
      return ok({ services: rows });
    }

    case 'service_save': {
      let id = intParam(ctx, 'id');
      const slug = strParam(ctx, 'slug', 80).replace(/[^a-z0-9-]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '');
      const name = strParam(ctx, 'name', 160);
      if (!slug || !name) fail('Slug dan nama wajib diisi.');
      const currencies = [].concat(param(ctx, 'currencies', []) || []).map((c) => String(c).trim().toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c));
      if (!currencies.length) fail('Minimal satu mata uang.');
      const presets = [];
      for (const pr of [].concat(param(ctx, 'presets', []) || [])) {
        if (!pr || typeof pr !== 'object' || !String(pr.label ?? '').trim()) continue;
        presets.push({ label: String(pr.label).trim(), amount: Number(pr.amount) || 0, currency: String(pr.currency || currencies[0]).toUpperCase(), custom: !!pr.custom });
      }
      const active = param(ctx, 'active', 1) ? 1 : 0;
      const vals = [slug, name, strParam(ctx, 'description', 1000), strParam(ctx, 'icon', 255), JSON.stringify(currencies), JSON.stringify(presets), active, now()];
      if (await db.prepare('SELECT id FROM services WHERE slug = ? AND id <> ?').bind(slug, id).first()) fail('Slug sudah dipakai layanan lain.');
      if (id > 0) {
        await db.prepare('UPDATE services SET slug=?, name=?, description=?, icon=?, currencies=?, presets=?, active=?, updated_at=? WHERE id=?').bind(...vals, id).run();
      } else {
        const sort = Number(await db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 v FROM services').first('v'));
        const res = await db.prepare('INSERT INTO services (slug, name, description, icon, currencies, presets, active, updated_at, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(...vals, sort, now()).run();
        id = Number(res.meta.last_row_id);
      }
      return ok({ id });
    }

    case 'service_toggle': {
      await db.prepare('UPDATE services SET active = ?, updated_at = ? WHERE id = ?').bind(param(ctx, 'active', 1) ? 1 : 0, now(), intParam(ctx, 'id')).run();
      return ok();
    }

    case 'service_delete': {
      await db.prepare('DELETE FROM services WHERE id = ?').bind(intParam(ctx, 'id')).run();
      return ok();
    }

    case 'service_sort': {
      const ids = [].concat(param(ctx, 'ids', []) || []);
      if (ids.length) await db.batch(ids.map((sid, i) => db.prepare('UPDATE services SET sort_order = ? WHERE id = ?').bind(i, parseInt(sid, 10) || 0)));
      return ok();
    }

    // ---------- Pengaturan ----------
    case 'settings': {
      const all = await settingsAll(db);
      delete all.admin_last_seen;
      return ok({ settings: all, admin });
    }

    case 'settings_save': {
      const allowed = Object.keys(defaultSettings());
      const input = param(ctx, 'settings', {}) || {};
      const stmts = [];
      for (const [k, raw] of Object.entries(input)) {
        if (k === 'admin_last_seen') continue;
        const isRate = /^rate_[A-Z]{3}$/.test(k);
        if (!allowed.includes(k) && !isRate) continue;
        let v = raw;
        if (isRate || NUMERIC_SETTINGS.includes(k)) {
          const n = Number(v);
          if (v === '' || v === null || !Number.isFinite(n) || n < 0) fail(`Nilai ${k} harus angka.`);
          v = String(n);
        }
        stmts.push(db.prepare('INSERT INTO settings (skey, svalue) VALUES (?,?) ON CONFLICT(skey) DO UPDATE SET svalue = excluded.svalue').bind(k, String(v).slice(0, 2000)));
      }
      if (stmts.length) await db.batch(stmts);
      return ok();
    }

    case 'password': {
      const oldPw = String(param(ctx, 'old_password', ''));
      const newPw = String(param(ctx, 'new_password', ''));
      const username = strParam(ctx, 'username', 64);
      if (newPw.length > 0 && newPw.length < 8) fail('Password baru minimal 8 karakter.');
      const hash = await db.prepare('SELECT password_hash v FROM admins WHERE id = ?').bind(admin.id).first('v');
      if (!(await verifyPassword(oldPw, hash))) fail('Password lama salah.');
      if (username && username !== admin.username) {
        await db.prepare('UPDATE admins SET username = ? WHERE id = ?').bind(username, admin.id).run();
      }
      if (newPw) await db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').bind(await hashPassword(newPw), admin.id).run();
      return ok();
    }

    default:
      return fail('Aksi tidak dikenal.', 404);
  }
}
