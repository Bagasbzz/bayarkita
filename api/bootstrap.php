<?php
/**
 * Inti API: koneksi DB (MySQL di cPanel / SQLite untuk uji lokal), migrasi
 * otomatis, seed data awal, helper JSON, sesi admin, dan kalkulasi fee.
 */
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'api/config.php belum dibuat. Salin dari config.sample.php.']);
    exit;
}
$CONFIG = require $configFile;
date_default_timezone_set($CONFIG['timezone'] ?? 'Asia/Jakarta');

set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    error_log('[bayarkita] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    echo json_encode(['ok' => false, 'error' => 'Terjadi kesalahan pada server.']);
    exit;
});

// ---------- Koneksi ----------
function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    global $CONFIG;
    $opt = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
    if (($CONFIG['driver'] ?? 'mysql') === 'sqlite') {
        $path = $CONFIG['sqlite'];
        if (!is_dir(dirname($path))) mkdir(dirname($path), 0775, true);
        $pdo = new PDO('sqlite:' . $path, null, null, $opt);
        $pdo->exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    } else {
        $m = $CONFIG['mysql'];
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $m['host'], $m['name'], $m['charset'] ?? 'utf8mb4');
        $pdo = new PDO($dsn, $m['user'], $m['pass'], $opt);
    }
    migrate($pdo);
    return $pdo;
}

function is_sqlite(): bool
{
    global $CONFIG;
    return ($CONFIG['driver'] ?? 'mysql') === 'sqlite';
}

// ---------- Migrasi + seed ----------
function migrate(PDO $pdo): void
{
    $pk = is_sqlite() ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY';
    $engine = is_sqlite() ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $ddl = [
        "CREATE TABLE IF NOT EXISTS settings (skey VARCHAR(64) PRIMARY KEY, svalue TEXT)$engine",
        "CREATE TABLE IF NOT EXISTS admins (id $pk, username VARCHAR(64) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL)$engine",
        "CREATE TABLE IF NOT EXISTS services (id $pk, slug VARCHAR(80) UNIQUE NOT NULL, name VARCHAR(160) NOT NULL, description TEXT, icon VARCHAR(255), currencies TEXT, presets TEXT, active TINYINT NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)$engine",
        "CREATE TABLE IF NOT EXISTS conversations (id $pk, token VARCHAR(64) UNIQUE NOT NULL, name VARCHAR(120) NOT NULL, phone VARCHAR(40) NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'open', unread_admin INT NOT NULL DEFAULT 0, unread_customer INT NOT NULL DEFAULT 0, last_message TEXT, last_sender VARCHAR(12), last_at DATETIME, customer_seen_at DATETIME, created_at DATETIME NOT NULL)$engine",
        "CREATE TABLE IF NOT EXISTS messages (id $pk, conversation_id INT NOT NULL, sender VARCHAR(12) NOT NULL, body TEXT NOT NULL, meta TEXT, created_at DATETIME NOT NULL)$engine",
        "CREATE TABLE IF NOT EXISTS orders (id $pk, code VARCHAR(24) UNIQUE NOT NULL, conversation_id INT NOT NULL, service_slug VARCHAR(80), service_name VARCHAR(160) NOT NULL, plan VARCHAR(120), amount DECIMAL(18,2) NOT NULL, currency VARCHAR(5) NOT NULL, rate DECIMAL(18,4) NOT NULL DEFAULT 1, amount_idr DECIMAL(18,2) NOT NULL, fee DECIMAL(18,2) NOT NULL, total DECIMAL(18,2) NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'baru', customer_name VARCHAR(120) NOT NULL, phone VARCHAR(40) NOT NULL, note TEXT, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)$engine",
    ];
    foreach ($ddl as $sql) $pdo->exec($sql);
    foreach (['CREATE INDEX idx_msg_conv ON messages (conversation_id, id)', 'CREATE INDEX idx_orders_status ON orders (status, created_at)', 'CREATE INDEX idx_conv_last ON conversations (last_at)'] as $idx) {
        try { $pdo->exec($idx); } catch (PDOException $e) { /* sudah ada */ }
    }
    seed($pdo);
}

function seed(PDO $pdo): void
{
    global $CONFIG;
    $now = now();
    if ((int)$pdo->query('SELECT COUNT(*) FROM admins')->fetchColumn() === 0) {
        $pdo->prepare('INSERT INTO admins (username, password_hash, created_at) VALUES (?,?,?)')
            ->execute([$CONFIG['admin_username'] ?? 'admin', password_hash($CONFIG['admin_password'] ?? 'admin', PASSWORD_DEFAULT), $now]);
    }
    $defaults = default_settings();
    $have = $pdo->query('SELECT skey FROM settings')->fetchAll(PDO::FETCH_COLUMN);
    $ins = $pdo->prepare('INSERT INTO settings (skey, svalue) VALUES (?,?)');
    foreach ($defaults as $k => $v) if (!in_array($k, $have, true)) $ins->execute([$k, (string)$v]);

    if ((int)$pdo->query('SELECT COUNT(*) FROM services')->fetchColumn() === 0) {
        $ins = $pdo->prepare('INSERT INTO services (slug, name, description, icon, currencies, presets, active, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?,?)');
        foreach (default_services() as $i => $s) {
            $ins->execute([$s['slug'], $s['name'], $s['description'], $s['icon'], json_encode($s['currencies']), json_encode($s['presets'], JSON_UNESCAPED_UNICODE), $i, $now, $now]);
        }
    }
}

function default_settings(): array
{
    return [
        'fee_idr_base' => 20000, 'fee_idr_pct' => 4.5,
        'fee_usd_min' => 20000, 'fee_usd_min_threshold' => 3, 'fee_usd_base' => 28000, 'fee_usd_pct' => 1,
        'rate_USD' => 18600, 'rate_EUR' => 21500, 'rate_GBP' => 24800, 'rate_JPY' => 125, 'rate_CNY' => 2600, 'rate_THB' => 570, 'rate_MYR' => 4400,
        'min_order_idr' => 20000, 'min_order_usd' => 1,
        'wa_number' => '628127968494', 'telegram' => 'fahmidev',
        'chat_greeting' => 'Halo! Ada yang bisa kami bantu? Tulis pesan Anda di sini, admin akan membalas secepatnya.',
        'chat_offline_note' => 'Admin sedang offline. Pesan Anda tetap tersimpan dan akan dibalas saat admin online.',
        'order_auto_reply' => 'Terima kasih, pesanan Anda sudah kami terima. Admin akan segera mengirimkan instruksi pembayaran di chat ini.',
        'quick_replies' => "Halo, terima kasih sudah menghubungi Fahmidev. Ada yang bisa kami bantu?\nPesanan Anda sedang kami proses, mohon tunggu sebentar ya.\nSilakan transfer ke rekening berikut lalu kirim bukti transfernya di sini.\nPembayaran sudah kami terima, pesanan akan segera diproses.\nPesanan Anda sudah selesai. Terima kasih sudah menggunakan jasa Fahmidev!",
        'admin_last_seen' => '',
    ];
}

function default_services(): array
{
    $p = function (string $label, float $amount, string $cur, bool $custom = false): array {
        return ['label' => $label, 'amount' => $amount, 'currency' => $cur, 'custom' => $custom];
    };
    return [
        ['slug' => 'custom-merchant', 'name' => 'Custom Merchant', 'description' => 'Bayar merchant luar negeri sesuai kebutuhan', 'icon' => 'assets/services/chatgpt-image-14-agu-2026-00-23-28-adcf0768-5f6b-4e92-8f12-6b5a97274040.png', 'currencies' => ['IDR', 'USD', 'EUR', 'GBP', 'THB', 'MYR', 'JPY', 'CNY'], 'presets' => [$p('All Merchant', 0, 'IDR', true)]],
        ['slug' => 'patreon', 'name' => 'Patreon', 'description' => 'Dukung kreator favorit Anda', 'icon' => 'assets/services/patreon-logo-icon-147253-9aa38885-ce2a-4135-a2fc-ada2aecb2991.webp', 'currencies' => ['USD', 'EUR'], 'presets' => [$p('Custom', 0, 'USD', true), $p('$1,1', 1.11, 'USD'), $p('$2,2', 2.22, 'USD'), $p('$3,3', 3.33, 'USD'), $p('$4,4', 4.44, 'USD'), $p('$5,5', 5.55, 'USD'), $p('$6,6', 6.66, 'USD'), $p('$7,7', 7.77, 'USD')]],
        ['slug' => 'jurnal-internasional', 'name' => 'Jurnal Internasional', 'description' => 'Akses jurnal dan publikasi akademik', 'icon' => 'assets/services/chatgpt-image-14-agu-2026-00-27-21-429aa2c6-3d70-4c8e-9947-bead95ce8ccc.png', 'currencies' => ['USD', 'EUR', 'GBP', 'JPY'], 'presets' => [$p('Custom', 0, 'USD', true)]],
        ['slug' => 'google-play-console', 'name' => 'Google Play Console', 'description' => 'Pembayaran pendaftaran Google Play Console', 'icon' => 'assets/services/google-play-console-icon-16066820-fff9-4f4c-b1ad-0c4c7883033f.png', 'currencies' => ['USD'], 'presets' => [$p('Google Play Console', 25, 'USD')]],
        ['slug' => 'shopify', 'name' => 'Shopify', 'description' => 'Bayar toko online berbasis Shopify', 'icon' => 'assets/services/2945149-033ca954-48c8-4d7c-8cf8-d507ef0ed7ac.webp', 'currencies' => ['USD', 'EUR', 'GBP'], 'presets' => [$p('Custom', 0, 'USD', true)]],
        ['slug' => 'chatgpt', 'name' => 'ChatGPT', 'description' => 'Akses AI terbaik untuk produktivitas', 'icon' => 'assets/services/chatgpt-logo-svg-9bcbeaa5-9b91-448d-8116-1ca8e762d2ae.png', 'currencies' => ['IDR', 'USD'], 'presets' => [$p('Go', 75000, 'IDR'), $p('Plus', 349000, 'IDR'), $p('Pro', 1889000, 'IDR'), $p('Custom', 0, 'IDR', true)]],
        ['slug' => 'claude', 'name' => 'Claude', 'description' => 'Akses AI untuk kerja dan riset', 'icon' => 'assets/services/claude-ai-symbol-svg-f7aaea3e-6fed-4222-b787-fd120f83196d.png', 'currencies' => ['USD', 'EUR'], 'presets' => [$p('Pro', 22.2, 'USD'), $p('Max 5X', 111, 'USD'), $p('Max 20X', 222, 'USD'), $p('Custom', 0, 'USD', true)]],
        ['slug' => 'ebay', 'name' => 'eBay', 'description' => 'Pembayaran tagihan belanja online di eBay, bantuan tracking paket tersedia', 'icon' => 'assets/logos/ebay.png', 'currencies' => ['IDR', 'USD', 'EUR', 'GBP', 'JPY'], 'presets' => [$p('Custom', 0, 'IDR', true)]],
    ];
}

// ---------- Helper umum ----------
function now(): string { return date('Y-m-d H:i:s'); }

function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ok(array $data = []): void { json_out(['ok' => true] + $data); }
function fail(string $msg, int $code = 400): void { json_out(['ok' => false, 'error' => $msg], $code); }

function input(): array
{
    static $in = null;
    if ($in !== null) return $in;
    $raw = file_get_contents('php://input');
    $json = $raw ? json_decode($raw, true) : null;
    $in = is_array($json) ? $json : $_POST;
    return $in;
}

function param(string $key, $default = null)
{
    $in = input();
    if (array_key_exists($key, $in)) return $in[$key];
    return $_GET[$key] ?? $default;
}

function str_param(string $key, int $max = 2000): string
{
    $v = param($key, '');
    return is_string($v) ? trim(mb_substr($v, 0, $max)) : '';
}

function method(): string { return $_SERVER['REQUEST_METHOD'] ?? 'GET'; }

function require_post(): void
{
    if (method() !== 'POST') fail('Metode tidak diizinkan.', 405);
}

function settings_all(): array
{
    $rows = db()->query('SELECT skey, svalue FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    return $rows + default_settings();
}

function setting(string $key, $default = null)
{
    static $cache = null;
    if ($cache === null) $cache = settings_all();
    return $cache[$key] ?? $default;
}

function set_setting(string $key, string $value): void
{
    $pdo = db();
    if (is_sqlite()) {
        $pdo->prepare('INSERT INTO settings (skey, svalue) VALUES (?,?) ON CONFLICT(skey) DO UPDATE SET svalue = excluded.svalue')->execute([$key, $value]);
    } else {
        $pdo->prepare('INSERT INTO settings (skey, svalue) VALUES (?,?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)')->execute([$key, $value]);
    }
}

/** Setting publik yang dibutuhkan kalkulator & widget chat di front-end. */
function public_settings(): array
{
    $s = settings_all();
    $rates = [];
    foreach ($s as $k => $v) if (strpos($k, 'rate_') === 0) $rates[substr($k, 5)] = (float)$v;
    $lastSeen = $s['admin_last_seen'] ? strtotime($s['admin_last_seen']) : 0;
    return [
        'fee' => [
            'idr_base' => (float)$s['fee_idr_base'], 'idr_pct' => (float)$s['fee_idr_pct'],
            'usd_min' => (float)$s['fee_usd_min'], 'usd_min_threshold' => (float)$s['fee_usd_min_threshold'],
            'usd_base' => (float)$s['fee_usd_base'], 'usd_pct' => (float)$s['fee_usd_pct'],
        ],
        'rates' => $rates,
        'min_order' => ['IDR' => (float)$s['min_order_idr'], 'USD' => (float)$s['min_order_usd']],
        'wa_number' => $s['wa_number'], 'telegram' => $s['telegram'],
        'chat_greeting' => $s['chat_greeting'], 'chat_offline_note' => $s['chat_offline_note'],
        'admin_online' => $lastSeen > 0 && (time() - $lastSeen) < 90,
    ];
}

/** Hitung fee & total di server agar nilai pesanan tidak bisa dimanipulasi klien. */
function calc_order(float $amount, string $currency): array
{
    $s = settings_all();
    $currency = strtoupper($currency);
    if ($currency === 'IDR') {
        $rate = 1.0;
        $idr = $amount;
        $fee = (float)$s['fee_idr_base'] + $idr * (float)$s['fee_idr_pct'] / 100;
    } else {
        $rate = (float)($s['rate_' . $currency] ?? $s['rate_USD']);
        $idr = $amount * $rate;
        $usdEquiv = $idr / (float)$s['rate_USD'];
        $fee = $usdEquiv < (float)$s['fee_usd_min_threshold']
            ? (float)$s['fee_usd_min']
            : (float)$s['fee_usd_base'] + $idr * (float)$s['fee_usd_pct'] / 100;
    }
    return ['rate' => $rate, 'amount_idr' => round($idr, 2), 'fee' => round($fee), 'total' => round($idr + $fee)];
}

function fmt_rp(float $n): string { return 'Rp ' . number_format(round($n), 0, ',', '.'); }

function fmt_amount(float $n, string $cur): string
{
    if ($cur === 'IDR') return 'IDR ' . number_format($n, 0, ',', '.');
    $sym = ['USD' => '$', 'EUR' => '€', 'GBP' => '£', 'JPY' => '¥', 'CNY' => '¥', 'THB' => '฿', 'MYR' => 'RM'][$cur] ?? ($cur . ' ');
    return $sym . number_format($n, floor($n) == $n ? 0 : 2, '.', ',');
}

function normalize_phone(string $phone): string
{
    $digits = preg_replace('/\D+/', '', $phone);
    if (strpos($digits, '0') === 0) $digits = '62' . substr($digits, 1);
    if (strpos($digits, '8') === 0) $digits = '62' . $digits;
    return $digits;
}

function random_token(int $bytes = 24): string { return bin2hex(random_bytes($bytes)); }

// ---------- Percakapan & pesan ----------
function conversation_by_token(string $token): ?array
{
    if ($token === '') return null;
    $st = db()->prepare('SELECT * FROM conversations WHERE token = ?');
    $st->execute([$token]);
    $row = $st->fetch();
    return $row ?: null;
}

function create_conversation(string $name, string $phone): array
{
    $pdo = db();
    $token = random_token();
    $now = now();
    $pdo->prepare('INSERT INTO conversations (token, name, phone, status, created_at, customer_seen_at) VALUES (?,?,?,?,?,?)')
        ->execute([$token, $name, $phone, 'open', $now, $now]);
    $id = (int)$pdo->lastInsertId();
    add_message($id, 'system', setting('chat_greeting'));
    return conversation_by_token($token);
}

function add_message(int $convId, string $sender, string $body, ?array $meta = null): int
{
    $pdo = db();
    $now = now();
    $pdo->prepare('INSERT INTO messages (conversation_id, sender, body, meta, created_at) VALUES (?,?,?,?,?)')
        ->execute([$convId, $sender, $body, $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null, $now]);
    $id = (int)$pdo->lastInsertId();
    // Pesan sistem dan admin menambah unread pelanggan; pesan pelanggan menambah unread admin.
    $col = $sender === 'customer' ? 'unread_admin' : 'unread_customer';
    $pdo->prepare("UPDATE conversations SET last_message = ?, last_sender = ?, last_at = ?, status = 'open', $col = $col + 1 WHERE id = ?")
        ->execute([mb_substr($body, 0, 160), $sender, $now, $convId]);
    return $id;
}

function messages_since(int $convId, int $since, int $limit = 200): array
{
    $st = db()->prepare('SELECT id, sender, body, meta, created_at FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC LIMIT ' . (int)$limit);
    $st->execute([$convId, $since]);
    $rows = $st->fetchAll();
    foreach ($rows as &$r) { $r['id'] = (int)$r['id']; $r['meta'] = $r['meta'] ? json_decode($r['meta'], true) : null; }
    return $rows;
}

// ---------- Sesi admin ----------
function admin_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax']);
    session_name('fdv_admin');
    session_start();
}

function current_admin(): ?array
{
    admin_session_start();
    if (empty($_SESSION['admin_id'])) return null;
    $st = db()->prepare('SELECT id, username FROM admins WHERE id = ?');
    $st->execute([$_SESSION['admin_id']]);
    $row = $st->fetch();
    return $row ?: null;
}

function require_admin(): array
{
    $admin = current_admin();
    if (!$admin) fail('Silakan login terlebih dahulu.', 401);
    // Proteksi CSRF sederhana: permintaan tulis harus datang dari fetch() front-end sendiri.
    if (method() === 'POST' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'fetch') fail('Permintaan ditolak.', 403);
    return $admin;
}
