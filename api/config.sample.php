<?php
/**
 * Salin file ini menjadi `config.php` lalu isi kredensial database cPanel.
 * `config.php` TIDAK boleh di-commit ke Git (sudah ada di .gitignore).
 */
return [
    // 'mysql' untuk hosting cPanel, 'sqlite' hanya untuk uji lokal.
    'driver'   => 'mysql',
    'mysql'    => [
        'host'     => 'localhost',
        'name'     => 'cpaneluser_bayarkita',
        'user'     => 'cpaneluser_bayarkita',
        'pass'     => 'GANTI_PASSWORD_DB',
        'charset'  => 'utf8mb4',
    ],
    'sqlite'   => __DIR__ . '/data/app.sqlite',

    // Akun admin awal (dibuat otomatis saat pertama kali API dijalankan).
    'admin_username' => 'admin',
    'admin_password' => 'GANTI_PASSWORD_ADMIN',

    'timezone' => 'Asia/Jakarta',
];
