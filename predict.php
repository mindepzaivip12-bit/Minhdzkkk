<?php
require_once __DIR__ . '/config.php';

$token = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? ($_GET['token'] ?? '');
$payload = verifyToken($token);

if (!$payload || ($payload['exp'] ?? 0) < time()) jsonResponse(['success' => false, 'msg' => 'Token hết hạn'], 401);

$key = $payload['key'];
$keys = loadKeys();
if (!isset($keys[$key]) || !empty($keys[$key]['banned']) || (!empty($keys[$key]['expires_at']) && time() > $keys[$key]['expires_at'])) {
    jsonResponse(['success' => false, 'msg' => 'Key bị khoá'], 401);
}

$url = UPSTREAM_API . '?t=' . time();
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 12,
    CURLOPT_SSL_VERIFYPEER => false, // Fix lỗi SSL trên host free
    CURLOPT_USERAGENT      => 'BON-Tool/1.0',
]);
$res = curl_exec($ch);
curl_close($ch);

if ($res === false) jsonResponse(['success' => false, 'msg' => 'Upstream unavailable'], 502);
header('Content-Type: application/json; charset=utf-8');
echo $res;
?>
