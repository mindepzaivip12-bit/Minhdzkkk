<?php
// Bật báo lỗi để dễ fix nếu có sự cố
error_reporting(E_ALL);
ini_set('display_errors', 1);

// ==========================================
define('SECRET_KEY', 'BON_TOOL_LC79_2024_SECRET_KEY_CHANGE_ME');
define('KEYS_FILE', __DIR__ . '/data/keys.json');
define('LOG_FILE',  __DIR__ . '/data/access.log');
define('ADMIN_PASS', 'Bon@2024Admin');
define('UPSTREAM_API', 'https://leminhdzctemd5.onrender.com/lc79md5');
define('TOKEN_TTL', 3600);

// Fix CORS cho Vercel gọi sang
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Auth-Token");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getClientIP() {
    return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function loadKeys() {
    if (!file_exists(KEYS_FILE)) return [];
    $raw = @file_get_contents(KEYS_FILE);
    return $raw ? (json_decode($raw, true) ?: []) : [];
}

function saveKeys($keys) {
    $dir = dirname(KEYS_FILE);
    if (!is_dir($dir)) @mkdir($dir, 0777, true);
    @file_put_contents(KEYS_FILE, json_encode($keys, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function signPayload($data) {
    $json = json_encode($data);
    $sig  = hash_hmac('sha256', $json, SECRET_KEY);
    return rtrim(strtr(base64_encode($json), '+/', '-_'), '=') . '.' . $sig;
}

function verifyToken($token) {
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2) return false;
    [$b64, $sig] = $parts;
    $pad  = strlen($b64) % 4;
    if ($pad) $b64 .= str_repeat('=', 4 - $pad);
    $json = base64_decode(strtr($b64, '-_', '+/'), true);
    if ($json === false) return false;
    $expected = hash_hmac('sha256', $json, SECRET_KEY);
    if (!hash_equals($expected, $sig)) return false;
    return json_decode($json, true);
}
?>
