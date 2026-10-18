<?php
/**
 * Chat pelanggan (publik). Identitas pelanggan = token acak yang disimpan di
 * localStorage browser.
 *   POST ?action=start   {name, phone}            -> buat percakapan, kembalikan token
 *   GET  ?action=poll    &token&since=<id>        -> pesan baru + status
 *   POST ?action=send    {token, body}            -> kirim pesan pelanggan
 *   POST ?action=seen    {token}                  -> tandai pesan admin sudah dibaca
 */
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = $_GET['action'] ?? param('action', '');

switch ($action) {
    case 'start':
        require_post();
        $name = str_param('name', 120);
        $phone = str_param('phone', 40);
        if (mb_strlen($name) < 2) fail('Nama wajib diisi.');
        $digits = normalize_phone($phone);
        if (strlen($digits) < 9 || strlen($digits) > 15) fail('Nomor WhatsApp tidak valid.');
        $conv = create_conversation($name, $digits);
        ok(['token' => $conv['token'], 'name' => $conv['name'], 'phone' => $conv['phone']]);

    case 'poll':
        $conv = conversation_by_token((string)($_GET['token'] ?? ''));
        if (!$conv) fail('Sesi chat tidak ditemukan.', 404);
        $since = (int)($_GET['since'] ?? 0);
        $msgs = messages_since((int)$conv['id'], $since);
        ok([
            'messages' => $msgs,
            'name' => $conv['name'],
            'unread' => (int)$conv['unread_customer'],
            'admin_online' => public_settings()['admin_online'],
        ]);

    case 'send':
        require_post();
        $conv = conversation_by_token(str_param('token', 64));
        if (!$conv) fail('Sesi chat tidak ditemukan.', 404);
        $body = str_param('body', 4000);
        if ($body === '') fail('Pesan kosong.');
        // Rate limit ringan: maksimal 20 pesan pelanggan per menit per percakapan.
        $st = db()->prepare("SELECT COUNT(*) FROM messages WHERE conversation_id = ? AND sender = 'customer' AND created_at > ?");
        $st->execute([$conv['id'], date('Y-m-d H:i:s', time() - 60)]);
        if ((int)$st->fetchColumn() >= 20) fail('Terlalu banyak pesan, coba lagi sebentar.', 429);
        $id = add_message((int)$conv['id'], 'customer', $body);
        ok(['id' => $id, 'created_at' => now()]);

    case 'seen':
        require_post();
        $conv = conversation_by_token(str_param('token', 64));
        if (!$conv) fail('Sesi chat tidak ditemukan.', 404);
        db()->prepare('UPDATE conversations SET unread_customer = 0, customer_seen_at = ? WHERE id = ?')->execute([now(), $conv['id']]);
        ok();

    default:
        fail('Aksi tidak dikenal.', 404);
}
