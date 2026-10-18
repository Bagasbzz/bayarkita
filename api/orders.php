<?php
/**
 * Pesanan dari popup checkout (publik).
 *   POST {name, phone, service_slug, service_name, plan, amount, currency, token?}
 *   -> membuat/memakai percakapan chat, menyimpan pesanan, dan mengirim
 *      ringkasan pesanan sebagai pesan ke chat web.
 */
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

require_post();

$name = str_param('name', 120);
$phone = normalize_phone(str_param('phone', 40));
$serviceSlug = str_param('service_slug', 80);
$serviceName = str_param('service_name', 160);
$plan = str_param('plan', 120);
$currency = strtoupper(str_param('currency', 5));
$amount = (float)param('amount', 0);
$token = str_param('token', 64);

if (mb_strlen($name) < 2) fail('Nama wajib diisi.');
if (strlen($phone) < 9 || strlen($phone) > 15) fail('Nomor WhatsApp tidak valid.');
if ($serviceName === '') fail('Layanan tidak valid.');
if (!preg_match('/^[A-Z]{3}$/', $currency)) fail('Mata uang tidak valid.');
if ($amount <= 0) fail('Jumlah tidak valid.');

$s = settings_all();
$min = $currency === 'IDR' ? (float)$s['min_order_idr'] : (float)$s['min_order_usd'];
if ($amount < $min) fail('Jumlah di bawah minimum pemesanan.');

$pdo = db();
$calc = calc_order($amount, $currency);

// Gunakan percakapan yang sudah ada di browser ini bila masih valid, kalau tidak buat baru.
$conv = conversation_by_token($token);
if (!$conv) {
    $conv = create_conversation($name, $phone);
} else {
    // Perbarui identitas bila pelanggan mengisi nama/nomor yang berbeda.
    $pdo->prepare('UPDATE conversations SET name = ?, phone = ? WHERE id = ?')->execute([$name, $phone, $conv['id']]);
}
$convId = (int)$conv['id'];

$code = 'FDV-' . date('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
$now = now();
$pdo->prepare('INSERT INTO orders (code, conversation_id, service_slug, service_name, plan, amount, currency, rate, amount_idr, fee, total, status, customer_name, phone, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    ->execute([$code, $convId, $serviceSlug, $serviceName, $plan, $amount, $currency, $calc['rate'], $calc['amount_idr'], $calc['fee'], $calc['total'], 'baru', $name, $phone, $now, $now]);
$orderId = (int)$pdo->lastInsertId();

$summary = "Pesanan baru #$code\n" .
    "Layanan: $serviceName" . ($plan !== '' ? " ($plan)" : '') . "\n" .
    'Harga: ' . fmt_amount($amount, $currency) . ($currency !== 'IDR' ? ' ≈ ' . fmt_rp($calc['amount_idr']) : '') . "\n" .
    'Biaya fee: ' . fmt_rp($calc['fee']) . "\n" .
    'Total: ' . fmt_rp($calc['total']);
add_message($convId, 'system', $summary, [
    'type' => 'order', 'order_id' => $orderId, 'code' => $code, 'status' => 'baru',
    'service_name' => $serviceName, 'plan' => $plan, 'amount' => $amount, 'currency' => $currency,
    'amount_idr' => $calc['amount_idr'], 'fee' => $calc['fee'], 'total' => $calc['total'],
]);
if (!empty($s['order_auto_reply'])) add_message($convId, 'system', $s['order_auto_reply']);

ok(['token' => $conv['token'], 'order' => ['id' => $orderId, 'code' => $code, 'total' => $calc['total'], 'fee' => $calc['fee']]]);
