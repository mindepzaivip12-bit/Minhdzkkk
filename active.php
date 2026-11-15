<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['success' => false, 'msg' => 'Method not allowed'], 405);

$input = json_decode(file_get_contents('php://input'), true);
$key   = trim($input['key'] ?? '');

if ($key === '' || strlen($key) < 8) jsonResponse(['success' => false, 'msg' => 'Key không hợp lệ!']);
if (!preg_match('/^BON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i', $key)) jsonResponse(['success' => false, 'msg' => 'Định dạng key sai! (BON-XXXX-XXXX-XXXX)']);

$keys = loadKeys();
if (!isset($keys[$key])) jsonResponse(['success' => false, 'msg' => 'Key không tồn tại!']);

$entry = $keys[$key];
$now   = time();

if (!empty($entry['banned'])) jsonResponse(['success' => false, 'msg' => 'Key đã bị khoá!']);
if (!empty($entry['expires_at']) && $now > $entry['expires_at']) jsonResponse(['success' => false, 'msg' => 'Key đã hết hạn!']);

$keys[$key]['last_used'] = $now;
$keys[$key]['last_ip']   = getClientIP();
$keys[$key]['uses']      = ($entry['uses'] ?? 0) + 1;
saveKeys($keys);

$token = signPayload(['key' => $key, 'exp' => $now + TOKEN_TTL, 'ip' => getClientIP()]);
$expiresAt = !empty($entry['expires_at']) ? date('c', $entry['expires_at']) : date('c', $now + 86400 * 3650);
$timeLeft = !empty($entry['expires_at']) ? max(0, ($entry['expires_at'] - $now) * 1000) : 86400 * 3650 * 1000;

jsonResponse([
    'success'    => true,
    'token'      => $token,
    'expires_at' => $expiresAt,
    'time_left'  => $timeLeft,
]);
?>
