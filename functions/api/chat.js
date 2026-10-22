/**
 * Chat pelanggan (publik). Identitas pelanggan = token acak di localStorage.
 *   POST ?action=start   {name, phone}       -> buat percakapan, kembalikan token
 *   GET  ?action=poll    &token&since=<id>   -> pesan baru + status
 *   POST ?action=send    {token, body}       -> kirim pesan pelanggan
 *   POST ?action=seen    {token}             -> tandai pesan admin sudah dibaca
 */
import {
  ok, fail, param, strParam, requirePost, now, secondsAgo, normalizePhone,
  settingsAll, publicSettings, conversationByToken, createConversation, addMessage, messagesSince,
} from '../_lib/core.js';

export async function onRequest({ data }) {
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
      const conv = await createConversation(db, await settingsAll(db), name, digits);
      return ok({ token: conv.token, name: conv.name, phone: conv.phone });
    }

    case 'poll': {
      const conv = await conversationByToken(db, ctx.url.searchParams.get('token') || '');
      if (!conv) fail('Sesi chat tidak ditemukan.', 404);
      const since = parseInt(ctx.url.searchParams.get('since') || '0', 10) || 0;
      return ok({
        messages: await messagesSince(db, conv.id, since),
        name: conv.name,
        unread: Number(conv.unread_customer),
        admin_online: publicSettings(await settingsAll(db)).admin_online,
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
