<?php
require_once __DIR__ . '/config.php';

// Session đơn giản
session_start();

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$pass   = $_POST['pass']   ?? $_GET['pass']   ?? '';

// Đăng nhập
if ($action === 'login') {
    if ($pass === ADMIN_PASS) {
        $_SESSION['admin'] = true;
        header('Location: admin.php');
        exit;
    }
    $loginError = 'Sai mật khẩu';
}

if ($action === 'logout') {
    session_destroy();
    header('Location: admin.php');
    exit;
}

// Xử lý thao tác (yêu cầu đã login)
if (!empty($_SESSION['admin'])) {
    if ($action === 'add') {
        $key = strtoupper(trim($_POST['key'] ?? ''));
        $days = (int)($_POST['days'] ?? 30);
        if (preg_match('/^BON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/', $key)) {
            $keys = loadKeys();
            if (!isset($keys[$key])) {
                $keys[$key] = [
                    'expires_at' => $days > 0 ? time() + $days * 86400 : 0,
                    'banned'     => false,
                    'bind_ip'    => null,
                    'uses'       => 0,
                    'last_used'  => 0,
                    'last_ip'    => null,
                    'created'    => time(),
                ];
                saveKeys($keys);
            }
        }
        header('Location: admin.php');
        exit;
    }
    if ($action === 'del') {
        $key  = $_POST['key'] ?? '';
        $keys = loadKeys();
        unset($keys[$key]);
        saveKeys($keys);
        header('Location: admin.php');
        exit;
    }
    if ($action === 'ban') {
        $key  = $_POST['key'] ?? '';
        $keys = loadKeys();
        if (isset($keys[$key])) {
            $keys[$key]['banned'] = !($keys[$key]['banned'] ?? false);
            saveKeys($keys);
        }
        header('Location: admin.php');
        exit;
    }
    if ($action === 'extend') {
        $key  = $_POST['key'] ?? '';
        $days = (int)($_POST['days'] ?? 30);
        $keys = loadKeys();
        if (isset($keys[$key])) {
            $base = max(time(), $keys[$key]['expires_at'] ?? 0);
            $keys[$key]['expires_at'] = $base + $days * 86400;
            saveKeys($keys);
        }
        header('Location: admin.php');
        exit;
    }
}

// Nếu chưa login → hiện form
if (empty($_SESSION['admin'])):
?>
<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin - BON TOOL</title>
<style>
body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{background:#1e293b;padding:30px;border-radius:14px;width:320px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
h1{font-size:18px;margin:0 0 20px;color:#38bdf8;text-align:center}
input{width:100%;padding:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;margin-bottom:12px;box-sizing:border-box}
button{width:100%;padding:12px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-weight:bold;cursor:pointer}
button:hover{background:#3b82f6}
.err{color:#f87171;text-align:center;margin-bottom:10px;font-size:13px}
</style>
</head>
<body>
<div class="box">
  <h1>🔐 ADMIN BON TOOL</h1>
  <?php if(!empty($loginError)): ?><div class="err"><?= htmlspecialchars($loginError) ?></div><?php endif; ?>
  <form method="post">
    <input type="hidden" name="action" value="login">
    <input type="password" name="pass" placeholder="Mật khẩu" required autofocus>
    <button type="submit">Đăng nhập</button>
  </form>
</div>
</body>
</html>
<?php
exit;
endif;

// Đã login → dashboard
$keys = loadKeys();
$now  = time();
?>
<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quản lý Key - BON TOOL</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:20px}
h1{color:#38bdf8;font-size:20px}
.card{background:#1e293b;border-radius:12px;padding:20px;margin-bottom:20px}
form.inline{display:flex;gap:10px;flex-wrap:wrap}
input,select{padding:10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:14px}
input[type=text]{flex:1;min-width:240px}
button{padding:10px 18px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-weight:bold;cursor:pointer}
button:hover{background:#3b82f6}
button.danger{background:#dc2626}
button.warn{background:#ea580c}
button.sm{padding:5px 10px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:10px;text-align:left;border-bottom:1px solid #334155}
th{color:#94a3b8;font-size:11px;text-transform:uppercase}
tr:hover{background:#0f172a}
.badge{display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold}
.ok{background:#166534;color:#86efac}
.exp{background:#7f1d1d;color:#fca5a5}
.ban{background:#7c2d12;color:#fdba74}
.mono{font-family:monospace;color:#38bdf8}
.logout{float:right;text-decoration:none;color:#f87171;font-size:13px}
.copy{cursor:pointer;color:#38bdf8;text-decoration:underline}
</style>
</head>
<body>
<h1>📋 QUẢN LÝ KEY <a class="logout" href="?action=logout">Đăng xuất</a></h1>

<div class="card">
  <h3 style="margin-top:0;font-size:14px;color:#94a3b8">➕ TẠO KEY MỚI</h3>
  <form class="inline" method="post">
    <input type="hidden" name="action" value="add">
    <input type="text" name="key" placeholder="BON-XXXX-XXXX-XXXX" required pattern="BON-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}" style="text-transform:uppercase">
    <select name="days">
      <option value="1">1 ngày</option>
      <option value="7">1 tuần</option>
      <option value="30" selected>1 tháng</option>
      <option value="365">1 năm</option>
      <option value="0">Vĩnh viễn</option>
    </select>
    <button type="submit">Tạo Key</button>
  </form>
</div>

<div class="card">
  <h3 style="margin-top:0;font-size:14px;color:#94a3b8">📊 DANH SÁCH KEY (<?= count($keys) ?>)</h3>
  <table>
    <thead>
      <tr>
        <th>Key</th><th>Trạng thái</th><th>Hết hạn</th><th>Lần dùng</th><th>IP cuối</th><th>Hành động</th>
      </tr>
    </thead>
    <tbody>
      <?php if(empty($keys)): ?>
      <tr><td colspan="6" style="text-align:center;color:#64748b">Chưa có key nào</td></tr>
      <?php else: foreach($keys as $k => $v):
        $exp  = $v['expires_at'] ?? 0;
        $expired = $exp > 0 && $now > $exp;
        $banned  = !empty($v['banned']);
      ?>
      <tr>
        <td class="mono"><?= htmlspecialchars($k) ?></td>
        <td>
          <?php if($banned): ?><span class="badge ban">BANNED</span>
          <?php elseif($expired): ?><span class="badge exp">HẾT HẠN</span>
          <?php else: ?><span class="badge ok">HOẠT ĐỘNG</span>
          <?php endif; ?>
        </td>
        <td><?= $exp > 0 ? date('d/m/Y H:i', $exp) : 'Vĩnh viễn' ?></td>
        <td><?= (int)($v['uses'] ?? 0) ?></td>
        <td class="mono" style="font-size:11px"><?= htmlspecialchars($v['last_ip'] ?? '-') ?></td>
        <td>
          <form method="post" style="display:inline" onsubmit="return confirm('Xoá key này?')">
            <input type="hidden" name="action" value="del">
            <input type="hidden" name="key" value="<?= htmlspecialchars($k) ?>">
            <button class="danger sm" type="submit">Xoá</button>
          </form>
          <form method="post" style="display:inline">
            <input type="hidden" name="action" value="ban">
            <input type="hidden" name="key" value="<?= htmlspecialchars($k) ?>">
            <button class="warn sm" type="submit"><?= $banned ? 'Mở' : 'Ban' ?></button>
          </form>
          <form method="post" style="display:inline">
            <input type="hidden" name="action" value="extend">
            <input type="hidden" name="key" value="<?= htmlspecialchars($k) ?>">
            <input type="hidden" name="days" value="30">
            <button class="sm" type="submit">+30d</button>
          </form>
        </td>
      </tr>
      <?php endforeach; endif; ?>
    </tbody>
  </table>
</div>

</body>
</html>
