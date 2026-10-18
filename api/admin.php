<?php
/**
 * API admin (butuh sesi login). Semua aksi lewat ?action=...
 * Auth      : login, logout, me
 * Dashboard : stats
 * Chat      : conversations, messages, reply, conv_status, conv_delete
 * Pesanan   : orders, order_status, order_note, order_delete
 * Katalog   : services, service_save, service_toggle, service_delete, service_sort
 * Setting   : settings, settings_save, password
 * Lainnya   : export_orders (CSV)
 */
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = $_GET['action'] ?? param('action', '');
$pdo = db();

// ---------- Auth ----------
if ($action === 'login') {
    require_post();
    admin_session_start();
    $u = str_param('username', 64);
    $p = (string)param('password', '');
    // Rate limit login: 8 percobaan gagal per 10 menit per sesi.
    $fails = $_SESSION['login_fails'] ?? [];
    $fails = array_values(array_filter($fails, fn($t) => $t > time() - 600));
    if (count($fails) >= 8) fail('Terlalu banyak percobaan. Coba lagi 10 menit.', 429);
    $st = $pdo->prepare('SELECT id, username, password_hash FROM admins WHERE username = ?');
    $st->execute([$u]);
    $row = $st->fetch();
    if (!$row || !password_verify($p, $row['password_hash'])) {
        $fails[] = time();
        $_SESSION['login_fails'] = $fails;
        fail('Username atau password salah.', 401);
    }
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int)$row['id'];
    unset($_SESSION['login_fails']);
    ok(['admin' => ['id' => (int)$row['id'], 'username' => $row['username']]]);
}
if ($action === 'logout') {
    admin_session_start();
    $_SESSION = [];
    session_destroy();
    ok();
}
if ($action === 'me') {
    $admin = current_admin();
    if (!$admin) fail('Belum login.', 401);
    ok(['admin' => $admin]);
}

$admin = require_admin();
set_setting('admin_last_seen', now()); // dipakai widget untuk indikator "admin online"

switch ($action) {
    // ---------- Dashboard ----------
    case 'stats':
        $today = date('Y-m-d 00:00:00');
        $month = date('Y-m-01 00:00:00');
        $q = fn(string $sql, array $p = []) => (function () use ($pdo, $sql, $p) { $s = $pdo->prepare($sql); $s->execute($p); return $s->fetchColumn(); })();
        $byStatus = $pdo->query('SELECT status, COUNT(*) c, COALESCE(SUM(total),0) t, COALESCE(SUM(fee),0) f FROM orders GROUP BY status')->fetchAll();
        $recent = $pdo->query('SELECT id, code, service_name, plan, customer_name, phone, total, currency, amount, status, created_at FROM orders ORDER BY id DESC LIMIT 8')->fetchAll();
        // Omzet 14 hari terakhir (pesanan selesai + diproses)
        $daily = [];
        $st = $pdo->prepare("SELECT created_at, total, fee FROM orders WHERE status IN ('diproses','selesai') AND created_at >= ?");
        $st->execute([date('Y-m-d 00:00:00', strtotime('-13 days'))]);
        for ($i = 13; $i >= 0; $i--) $daily[date('Y-m-d', strtotime("-$i days"))] = ['total' => 0, 'fee' => 0, 'count' => 0];
        foreach ($st as $r) { $d = substr($r['created_at'], 0, 10); if (isset($daily[$d])) { $daily[$d]['total'] += (float)$r['total']; $daily[$d]['fee'] += (float)$r['fee']; $daily[$d]['count']++; } }
        $top = $pdo->query('SELECT service_name, COUNT(*) c, COALESCE(SUM(total),0) t FROM orders GROUP BY service_name ORDER BY c DESC LIMIT 6')->fetchAll();
        ok([
            'orders_today' => (int)$q('SELECT COUNT(*) FROM orders WHERE created_at >= ?', [$today]),
            'orders_month' => (int)$q('SELECT COUNT(*) FROM orders WHERE created_at >= ?', [$month]),
            'orders_new' => (int)$q("SELECT COUNT(*) FROM orders WHERE status = 'baru'"),
            'orders_processing' => (int)$q("SELECT COUNT(*) FROM orders WHERE status = 'diproses'"),
            'revenue_month' => (float)$q("SELECT COALESCE(SUM(total),0) FROM orders WHERE status = 'selesai' AND created_at >= ?", [$month]),
            'fee_month' => (float)$q("SELECT COALESCE(SUM(fee),0) FROM orders WHERE status = 'selesai' AND created_at >= ?", [$month]),
            'unread_chats' => (int)$q('SELECT COUNT(*) FROM conversations WHERE unread_admin > 0'),
            'open_chats' => (int)$q("SELECT COUNT(*) FROM conversations WHERE status = 'open'"),
            'total_customers' => (int)$q('SELECT COUNT(*) FROM conversations'),
            'by_status' => $byStatus, 'recent_orders' => $recent, 'daily' => $daily, 'top_services' => $top,
        ]);

    // ---------- Chat ----------
    case 'conversations':
        $filter = $_GET['filter'] ?? 'all';
        $qs = trim((string)($_GET['q'] ?? ''));
        $where = []; $p = [];
        if ($filter === 'unread') $where[] = 'c.unread_admin > 0';
        elseif ($filter === 'open') $where[] = "c.status = 'open'";
        elseif ($filter === 'closed') $where[] = "c.status = 'closed'";
        if ($qs !== '') { $where[] = '(c.name LIKE ? OR c.phone LIKE ? OR c.last_message LIKE ?)'; $p = ["%$qs%", "%$qs%", "%$qs%"]; }
        $sql = 'SELECT c.id, c.token, c.name, c.phone, c.status, c.unread_admin, c.last_message, c.last_sender, c.last_at, c.created_at,
                (SELECT COUNT(*) FROM orders o WHERE o.conversation_id = c.id) AS order_count
                FROM conversations c' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY COALESCE(c.last_at, c.created_at) DESC LIMIT 200';
        $st = $pdo->prepare($sql); $st->execute($p);
        $rows = $st->fetchAll();
        foreach ($rows as &$r) { $r['id'] = (int)$r['id']; $r['unread_admin'] = (int)$r['unread_admin']; $r['order_count'] = (int)$r['order_count']; unset($r['token']); }
        ok(['conversations' => $rows, 'total_unread' => (int)$pdo->query('SELECT COUNT(*) FROM conversations WHERE unread_admin > 0')->fetchColumn()]);

    case 'messages':
        $id = (int)($_GET['id'] ?? 0);
        $since = (int)($_GET['since'] ?? 0);
        $st = $pdo->prepare('SELECT id, name, phone, status, created_at FROM conversations WHERE id = ?');
        $st->execute([$id]);
        $conv = $st->fetch();
        if (!$conv) fail('Percakapan tidak ditemukan.', 404);
        $msgs = messages_since($id, $since, 500);
        if ($since === 0 || $msgs) $pdo->prepare('UPDATE conversations SET unread_admin = 0 WHERE id = ?')->execute([$id]);
        $os = $pdo->prepare('SELECT id, code, service_name, plan, amount, currency, fee, total, status, created_at FROM orders WHERE conversation_id = ? ORDER BY id DESC');
        $os->execute([$id]);
        ok(['conversation' => $conv, 'messages' => $msgs, 'orders' => $os->fetchAll()]);

    case 'reply':
        $id = (int)param('id', 0);
        $body = str_param('body', 4000);
        if ($body === '') fail('Pesan kosong.');
        $st = $pdo->prepare('SELECT id FROM conversations WHERE id = ?'); $st->execute([$id]);
        if (!$st->fetch()) fail('Percakapan tidak ditemukan.', 404);
        $mid = add_message($id, 'admin', $body);
        $pdo->prepare('UPDATE conversations SET unread_admin = 0 WHERE id = ?')->execute([$id]);
        ok(['id' => $mid, 'created_at' => now()]);

    case 'conv_status':
        $id = (int)param('id', 0);
        $status = str_param('status', 12);
        if (!in_array($status, ['open', 'closed'], true)) fail('Status tidak valid.');
        $pdo->prepare('UPDATE conversations SET status = ? WHERE id = ?')->execute([$status, $id]);
        ok();

    case 'conv_delete':
        $id = (int)param('id', 0);
        $pdo->prepare('DELETE FROM messages WHERE conversation_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM orders WHERE conversation_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM conversations WHERE id = ?')->execute([$id]);
        ok();

    // ---------- Pesanan ----------
    case 'orders':
        $status = $_GET['status'] ?? '';
        $qs = trim((string)($_GET['q'] ?? ''));
        $page = max(1, (int)($_GET['page'] ?? 1));
        $per = 25;
        $where = []; $p = [];
        if (in_array($status, ['baru', 'diproses', 'selesai', 'batal'], true)) { $where[] = 'status = ?'; $p[] = $status; }
        if ($qs !== '') { $where[] = '(code LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR service_name LIKE ?)'; array_push($p, "%$qs%", "%$qs%", "%$qs%", "%$qs%"); }
        $w = $where ? ' WHERE ' . implode(' AND ', $where) : '';
        $cnt = $pdo->prepare("SELECT COUNT(*) FROM orders$w"); $cnt->execute($p);
        $total = (int)$cnt->fetchColumn();
        $st = $pdo->prepare("SELECT * FROM orders$w ORDER BY id DESC LIMIT $per OFFSET " . (($page - 1) * $per));
        $st->execute($p);
        ok(['orders' => $st->fetchAll(), 'total' => $total, 'page' => $page, 'pages' => max(1, (int)ceil($total / $per))]);

    case 'order_status':
        $id = (int)param('id', 0);
        $status = str_param('status', 12);
        $note = str_param('message', 1000);
        if (!in_array($status, ['baru', 'diproses', 'selesai', 'batal'], true)) fail('Status tidak valid.');
        $st = $pdo->prepare('SELECT * FROM orders WHERE id = ?'); $st->execute([$id]);
        $o = $st->fetch();
        if (!$o) fail('Pesanan tidak ditemukan.', 404);
        $pdo->prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')->execute([$status, now(), $id]);
        if ($o['status'] !== $status) {
            $labels = ['baru' => 'Baru', 'diproses' => 'Diproses', 'selesai' => 'Selesai', 'batal' => 'Dibatalkan'];
            $text = "Status pesanan #{$o['code']} diperbarui menjadi: {$labels[$status]}." . ($note !== '' ? "\n$note" : '');
            add_message((int)$o['conversation_id'], 'system', $text, ['type' => 'status', 'order_id' => $id, 'code' => $o['code'], 'status' => $status]);
        } elseif ($note !== '') {
            add_message((int)$o['conversation_id'], 'admin', $note);
        }
        ok();

    case 'order_note':
        $id = (int)param('id', 0);
        $pdo->prepare('UPDATE orders SET note = ?, updated_at = ? WHERE id = ?')->execute([str_param('note', 2000), now(), $id]);
        ok();

    case 'order_delete':
        $pdo->prepare('DELETE FROM orders WHERE id = ?')->execute([(int)param('id', 0)]);
        ok();

    case 'export_orders':
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="pesanan-' . date('Ymd-His') . '.csv"');
        $out = fopen('php://output', 'w');
        fputs($out, "\xEF\xBB\xBF");
        fputcsv($out, ['Kode', 'Tanggal', 'Pelanggan', 'WhatsApp', 'Layanan', 'Paket', 'Jumlah', 'Mata Uang', 'Kurs', 'Nominal IDR', 'Fee', 'Total', 'Status', 'Catatan']);
        foreach ($pdo->query('SELECT * FROM orders ORDER BY id DESC') as $o) {
            fputcsv($out, [$o['code'], $o['created_at'], $o['customer_name'], $o['phone'], $o['service_name'], $o['plan'], $o['amount'], $o['currency'], $o['rate'], $o['amount_idr'], $o['fee'], $o['total'], $o['status'], $o['note']]);
        }
        exit;

    // ---------- Katalog layanan ----------
    case 'services':
        $rows = $pdo->query('SELECT * FROM services ORDER BY sort_order, id')->fetchAll();
        foreach ($rows as &$r) { $r['id'] = (int)$r['id']; $r['active'] = (int)$r['active']; $r['currencies'] = json_decode($r['currencies'] ?: '[]'); $r['presets'] = json_decode($r['presets'] ?: '[]'); }
        ok(['services' => $rows]);

    case 'service_save':
        $id = (int)param('id', 0);
        $slug = strtolower(preg_replace('/[^a-z0-9-]+/i', '-', str_param('slug', 80)));
        $slug = trim($slug, '-');
        $name = str_param('name', 160);
        if ($slug === '' || $name === '') fail('Slug dan nama wajib diisi.');
        $currencies = array_values(array_filter(array_map(fn($c) => strtoupper(trim((string)$c)), (array)param('currencies', [])), fn($c) => preg_match('/^[A-Z]{3}$/', $c)));
        if (!$currencies) fail('Minimal satu mata uang.');
        $presets = [];
        foreach ((array)param('presets', []) as $pr) {
            if (!is_array($pr) || trim((string)($pr['label'] ?? '')) === '') continue;
            $presets[] = ['label' => trim((string)$pr['label']), 'amount' => (float)($pr['amount'] ?? 0), 'currency' => strtoupper((string)($pr['currency'] ?? $currencies[0])), 'custom' => !empty($pr['custom'])];
        }
        $vals = [$slug, $name, str_param('description', 1000), str_param('icon', 255), json_encode($currencies), json_encode($presets, JSON_UNESCAPED_UNICODE), (int)!!param('active', 1), now()];
        $dup = $pdo->prepare('SELECT id FROM services WHERE slug = ? AND id <> ?'); $dup->execute([$slug, $id]);
        if ($dup->fetch()) fail('Slug sudah dipakai layanan lain.');
        if ($id > 0) {
            $pdo->prepare('UPDATE services SET slug=?, name=?, description=?, icon=?, currencies=?, presets=?, active=?, updated_at=? WHERE id=?')->execute([...$vals, $id]);
        } else {
            $sort = (int)$pdo->query('SELECT COALESCE(MAX(sort_order),0)+1 FROM services')->fetchColumn();
            $pdo->prepare('INSERT INTO services (slug, name, description, icon, currencies, presets, active, updated_at, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([...$vals, $sort, now()]);
            $id = (int)$pdo->lastInsertId();
        }
        ok(['id' => $id]);

    case 'service_toggle':
        $pdo->prepare('UPDATE services SET active = ?, updated_at = ? WHERE id = ?')->execute([(int)!!param('active', 1), now(), (int)param('id', 0)]);
        ok();

    case 'service_delete':
        $pdo->prepare('DELETE FROM services WHERE id = ?')->execute([(int)param('id', 0)]);
        ok();

    case 'service_sort':
        $ids = (array)param('ids', []);
        $st = $pdo->prepare('UPDATE services SET sort_order = ? WHERE id = ?');
        foreach (array_values($ids) as $i => $sid) $st->execute([$i, (int)$sid]);
        ok();

    // ---------- Pengaturan ----------
    case 'settings':
        $all = settings_all();
        unset($all['admin_last_seen']);
        ok(['settings' => $all, 'admin' => $admin]);

    case 'settings_save':
        $allowed = array_keys(default_settings());
        $in = (array)param('settings', []);
        $numeric = ['fee_idr_base', 'fee_idr_pct', 'fee_usd_min', 'fee_usd_min_threshold', 'fee_usd_base', 'fee_usd_pct', 'min_order_idr', 'min_order_usd'];
        foreach ($in as $k => $v) {
            if ($k === 'admin_last_seen') continue;
            $isRate = strpos($k, 'rate_') === 0 && preg_match('/^rate_[A-Z]{3}$/', $k);
            if (!in_array($k, $allowed, true) && !$isRate) continue;
            if ($isRate || in_array($k, $numeric, true)) {
                if (!is_numeric($v) || (float)$v < 0) fail("Nilai $k harus angka.");
                $v = (string)(float)$v;
            }
            set_setting($k, mb_substr((string)$v, 0, 2000));
        }
        ok();

    case 'password':
        $old = (string)param('old_password', '');
        $new = (string)param('new_password', '');
        $username = str_param('username', 64);
        if (strlen($new) > 0 && strlen($new) < 8) fail('Password baru minimal 8 karakter.');
        $st = $pdo->prepare('SELECT password_hash FROM admins WHERE id = ?'); $st->execute([$admin['id']]);
        if (!password_verify($old, (string)$st->fetchColumn())) fail('Password lama salah.');
        if ($username !== '' && $username !== $admin['username']) {
            $pdo->prepare('UPDATE admins SET username = ? WHERE id = ?')->execute([$username, $admin['id']]);
        }
        if ($new !== '') $pdo->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $admin['id']]);
        ok();

    default:
        fail('Aksi tidak dikenal.', 404);
}
