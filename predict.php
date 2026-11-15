<?php
require_once __DIR__ . '/config.php';

corsHeaders();
rateLimitCheck(getClientIP());

// Nhận token từ header hoặc query
$token = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? ($_GET['token'] ?? '');
$payload = verifyToken($token);

if (!$payload || ($payload['exp'] ?? 0) < time()) {
    jsonResponse(['success' => false, 'msg' => 'Token không hợp lệ hoặc hết hạn'], 401);
}

$key   = $payload['key'];
$keys  = loadKeys();

if (!isset($keys[$key])) {
    jsonResponse(['success' => false, 'msg' => 'Key không tồn tại'], 401);
}

$entry = $keys[$key];
if (!empty($entry['banned']) || (!empty($entry['expires_at']) && time() > $entry['expires_at'])) {
    jsonResponse(['success' => false, 'msg' => 'Key đã bị khoá/hết hạn'], 401);
}

// Gọi upstream bằng cURL (hoặc fallback file_get_contents)
$url = UPSTREAM_API . '?t=' . time();
$res = false;

if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 12,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'BON-Tool/1.0',
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200) $res = false;
} else {
    $ctx = stream_context_create([
        'http' => ['method' => 'GET', 'timeout' => 12, 'header' => "User-Agent: BON-Tool/1.0\r\n"],
        'ssl'  => ['verify_peer' => true, 'verify_peer_name' => true],
    ]);
    $res = @file_get_contents($url, false, $ctx);
}

if ($res === false || $res === '') {
    jsonResponse(['success' => false, 'msg' => 'Upstream unavailable'], 502);
}

header('Content-Type: application/json; charset=utf-8');
echo $res;
