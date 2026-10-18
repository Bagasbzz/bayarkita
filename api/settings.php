<?php
/** GET: setting publik (fee, kurs, kontak) untuk kalkulator & widget. */
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$data = public_settings();
if (isset($_GET['services'])) {
    $rows = db()->query('SELECT slug, name, description, icon, currencies, presets FROM services WHERE active = 1 ORDER BY sort_order, id')->fetchAll();
    foreach ($rows as &$r) { $r['currencies'] = json_decode($r['currencies'] ?: '[]'); $r['presets'] = json_decode($r['presets'] ?: '[]'); }
    $data['services'] = $rows;
}
ok($data);
