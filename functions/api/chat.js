/**
 * Live Chat pelanggan (publik). Identitas pelanggan = token acak di localStorage.
 *   POST ?action=start   {name, phone}            -> buat percakapan + antrian, kembalikan token & detik antrian
 *   GET  ?action=poll    &token&since=<id>&vsince -> pesan baru, status antrian/terhubung, agen, typing
 *   POST ?action=send    {token, body}            -> kirim pesan pelanggan (memicu balasan AI)
 *   POST ?action=seen    {token}                  -> tandai pesan admin sudah dibaca
 */
import {
  ok, fail, param, strParam, requirePost, now, fmtLocal, parseLocal, secondsAgo, normalizePhone,
  settingsAll, publicSettings, conversationByToken, createConversation, addMessage, messagesSince, hasPendingReply,
} from '../_lib/core.js';
import { pickAgent, randInt, greetingFor, scheduleAiReply } from '../_lib/ai.js';

const aiOn = (s, env) => String(s.ai_enabled) === '1' && !!env.AI_API_KEY;

/** Saat pelanggan baru tersambung (lewat waktu antrian), kirim sapaan agen sekali. */
async function ensureConnected(db, conv) {
  if (!conv.agent || !conv.connected_at) return { connected: true, queue_left: 0 };
  const left = Math.ceil((parseLocal(conv.connected_at) - Date.now()) / 1000);
  if (left > 0) return { connected: false, queue_left: left };
  const c = await db.prepare("SELECT COUNT(*) c FROM messages WHERE conversation_id = ? AND sender = 'system' AND meta LIKE '%\"connected\"%'").bind(conv.id).first('c');
  if (Number(c) === 0) {
    await addMessage(db, conv.id, 'system', `Anda terhubung dengan ${conv.agent}.`, { type: 'connected', agent: conv.agent });
    // Sapaan: 2-4 dtk "membaca" lalu 4-7 dtk mengetik.
    const readMs = randInt(2, 4) * 1000, typeMs = randInt(4, 7) * 1000;
    await addMessage(db, conv.id, 'admin', greetingFor(conv.agent, conv.name),
      { agent: conv.agent, greeting: 1, typing_from: fmtLocal(new Date(Date.now() + readMs)) },
      fmtLocal(new Date(Date.now() + readMs + typeMs)));
  }
  return { connected: true, queue_left: 0 };
}

export async function onRequest(context) {
  const { data, env } = context;
  const ctx = data.ctx;
  const { db } = ctx;
  const action = param(ctx, 'action', '');

  switch (action) {
    case 'start': {
      requirePost(ctx);
      const name = strParam(ctx, 'name', 120);
      const digits = normalizePhone(strParam(ctx, 'phone', 40));
      if (name.length < 2) fail('Nama wajib diisi.');
      if (digits.length < 9 || digits.length > 15) fail('Nomor WhatsApp tidak valid.');
      const s = await settingsAll(db);
      let agent = null, queue = 0;
      if (aiOn(s, env)) {
        agent = pickAgent();
        queue = randInt(Number(s.ai_queue_min || 6), Number(s.ai_queue_max || 20));
      }
      const conv = await createConversation(db, s, name, digits, agent, agent ? fmtLocal(new Date(Date.now() + queue * 1000)) : null);
      return ok({ token: conv.token, name: conv.name, phone: conv.phone, queue_left: queue, agent: agent || null });
    }

    case 'poll': {
      const conv = await conversationByToken(db, ctx.url.searchParams.get('token') || '');
      if (!conv) fail('Sesi chat tidak ditemukan.', 404);
      const since = parseInt(ctx.url.searchParams.get('since') || '0', 10) || 0;
      const vsince = ctx.url.searchParams.get('vsince') || '';
      const st = await ensureConnected(db, conv);
      const msgs = st.connected ? await messagesSince(db, conv.id, since, 200, true, vsince) : [];
      const s = await settingsAll(db);
      const ai = Number(conv.ai_enabled) === 1 && aiOn(s, env);
      return ok({
        messages: msgs,
        name: conv.name,
        agent: conv.agent || null,
        connected: st.connected,
        queue_left: st.queue_left,
        typing: st.connected && (await hasPendingReply(db, conv.id)),
        unread: Number(conv.unread_customer),
        admin_online: ai || publicSettings(s).admin_online,
      });
    }

    case 'send': {
      requirePost(ctx);
      const conv = await conversationByToken(db, strParam(ctx, 'token', 64));
      if (!conv) fail('Sesi chat tidak ditemukan.', 404);
      const body = strParam(ctx, 'body', 4000);
      if (!body) fail('Pesan kosong.');
      // Rate limit ringan: maksimal 20 pesan pelanggan per menit per percakapan.
      const c = await db.prepare("SELECT COUNT(*) AS c FROM messages WHERE conversation_id = ? AND sender = 'customer' AND created_at > ?")
        .bind(conv.id, secondsAgo(60)).first('c');
      if (Number(c) >= 20) fail('Terlalu banyak pesan, coba lagi sebentar.', 429);
      const id = await addMessage(db, conv.id, 'customer', body);
      // Balasan AI dibuat di latar belakang agar respons ke pelanggan cepat.
      if (Number(conv.ai_enabled) === 1) context.waitUntil(scheduleAiReply(env, conv.id).catch((e) => console.error('[ai]', e)));
      return ok({ id, created_at: now() });
    }

    case 'seen': {
      requirePost(ctx);
      const conv = await conversationByToken(db, strParam(ctx, 'token', 64));
      if (!conv) fail('Sesi chat tidak ditemukan.', 404);
      await db.prepare('UPDATE conversations SET unread_customer = 0, customer_seen_at = ? WHERE id = ?').bind(now(), conv.id).run();
      return ok();
    }

    default:
      return fail('Aksi tidak dikenal.', 404);
  }
}
