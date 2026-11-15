<?php
require_once __DIR__ . '/config.php';

$pass = $_GET['pass'] ?? '';
if ($pass !== ADMIN_PASS) {
    jsonResponse(['success' => false, 'msg' => 'Sai mật khẩu'], 403);
}

$key  = trim($_GET['key'] ?? '');
$days = (int)($_GET['days'] ?? 30);
$ip   = trim($_GET['ip']   ?? ''); // optional bind IP

if (!preg_match('/^BON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i', $key)) {
    jsonResponse(['success' => false, 'msg' => 'Key phải đúng format BON-XXXX-XXXX-XXXX']);
}

$keys = loadKeys();

if (isset($keys[$key])) {
    jsonResponse(['success' => false, 'msg' => 'Key đã tồn tại']);
}

$keys[$key] = [
    'expires_at' => $days > 0 ? time() + $days * 86400 : 0,
    'banned'     => false,
    'bind_ip'    => $ip ?: null,
    'uses'       => 0,
    'last_used'  => 0,
    'last_ip'    => null,
    'created'    => time(),
];

saveKeys($keys);
logAccess("ADD_KEY: $key | days=$days | ip=" . ($ip ?: '-'));

jsonResponse([
    'success'    => true,
    'key'        => $key,
    'days'       => $days,
    'expires_at' => $days > 0 ? date('c', time() + $days * 86400) : 'never',
]);
