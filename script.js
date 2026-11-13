/* =========================================================
   CẤU HÌNH HỆ THỐNG
   ========================================================= */
const API_SERVER = "https://lc79vipadmin.onrender.com"; // Server Admin của bạn
const API_PREDICT = "https://leminhapiii.onrender.com/lc79md5"; // Server dự đoán

const root = document.getElementById("robot");
const expiryEl = document.getElementById('expiry-timer');
let isLoggingIn = false;
let robotRunning = false;
let countdownInterval = null;

/* =========================================================
   CÁC HÀM XỬ LÝ CHÍNH
   ========================================================= */

// 1. Tính năng Dán Key tự động
async function pasteKey() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById('input-key').value = text;
  } catch (err) { 
    alert("Trình duyệt không cho phép dán tự động, vui lòng nhập tay!"); 
  }
}

// 2. Đếm ngược thời gian (Format HH:MM:SS) - Đã Fix NaN
function startCountdown(expiresAt) {
  clearInterval(countdownInterval);
  
  const timerEl = document.getElementById('expiry-timer');
  const timeText = document.getElementById('time-text');
  
  // Nếu không tìm thấy thẻ HTML (đề phòng lỗi DOM)
  if (!timerEl || !timeText) return; 
  
  timerEl.classList.add('active');
  timerEl.classList.remove('warning');

  function update() {
    const now = new Date().getTime();
    const msLeft = expiresAt - now;

    // Xử lý khi hết hạn hoặc dữ liệu thời gian bị lỗi
    if (isNaN(msLeft) || msLeft <= 0) {
      clearInterval(countdownInterval);
      timeText.innerText = "00:00:00";
      timerEl.classList.add('warning');
      
      // Tự động đăng xuất và khóa tool
      localStorage.removeItem("nexton_key");
      document.getElementById('robot-container').style.display = 'none';
      document.getElementById('login-wrapper').classList.remove('hidden');
      
      // Load lại trang sau 2s để reset toàn bộ trạng thái
      setTimeout(() => window.location.reload(), 2000);
      return;
    }

    // Chuyển đổi mili-giây sang Giờ : Phút : Giây
    const totalSecs = Math.floor(msLeft / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    // Format cho đẹp (Thêm số 0 nếu < 10)
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    
    timeText.innerText = `${hh}:${mm}:${ss}`;
  }

  // Chạy ngay lần đầu để tránh độ trễ 1 giây
  update();
  // Lặp lại mỗi 1 giây
  countdownInterval = setInterval(update, 1000);
}

// 3. Xử lý khi bấm nút Đăng Nhập
async function handleActivate() {
  if (isLoggingIn) return;
  
  const keyInput = document.getElementById('input-key');
  const key = keyInput.value.trim();
  const btn = document.getElementById('btn-submit');
  const btnText = document.getElementById('btnText');
  const errEl = document.getElementById('error-msg');

  // Kiểm tra rỗng
  if(!key) { 
    errEl.innerText = "Vui lòng nhập key!"; 
    errEl.style.display = 'block'; 
    return; 
  }
  
  isLoggingIn = true;
  btn.disabled = true; 
  btnText.innerText = "ĐANG XÁC THỰC"; 
  errEl.style.display = 'none';

  try {
    // Gửi Request lên Server Admin
    const res = await fetch(`${API_SERVER}/api/activate`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key })
    });
    
    const data = await res.json();

    // Nếu Server trả về thành công
    if(data.success) {
      localStorage.setItem("nexton_key", key);
      
      // Xử lý thời gian hết hạn
      let expireTime = 0;
      if (data.expires_at) {
        try { expireTime = new Date(data.expires_at).getTime(); } catch(e) {}
      } 
      
      // Nếu parse ngày tháng thất bại, dùng time_left (mili-giây) cộng với hiện tại
      if (isNaN(expireTime) || expireTime <= 0) {
        const msLeft = data.time_left || data.timeLeft || 0;
        expireTime = new Date().getTime() + msLeft;
      }

      startCountdown(expireTime); 
      
      // Đợi 1 giây cho hiệu ứng mượt rồi ẩn form, hiện Robot
      setTimeout(() => {
        document.getElementById('login-wrapper').classList.add('hidden');
        document.getElementById('robot-container').style.display = 'block';
        startRobot();
      }, 1000);
      
    } else {
      // Key sai hoặc hết hạn
      errEl.innerText = data.msg || data.message || "Key không hợp lệ!";
      errEl.style.display = 'block';
      btn.disabled = false; 
      btnText.innerText = "VÀO HỆ THỐNG";
    }
  } catch (e) { 
    // Lỗi mạng
    errEl.innerText = "Lỗi kết nối Server Admin!"; 
    errEl.style.display = 'block';
    btn.disabled = false; 
    btnText.innerText = "VÀO HỆ THỐNG";
  } finally {
    isLoggingIn = false;
  }
}

// 4. Kiểm tra lại Key khi tải lại trang (Auto Login)
async function checkAuth() {
  const savedKey = localStorage.getItem("nexton_key");
  if(!savedKey) return; // Không có key thì hiện form

  try {
    const res = await fetch(`${API_SERVER}/api/activate`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: savedKey })
    });
    const data = await res.json();

    if(data.success) {
      let expireTime = 0;
      if (data.expires_at) {
        try { expireTime = new Date(data.expires_at).getTime(); } catch(e) {}
      } 
      if (isNaN(expireTime) || expireTime <= 0) {
        const msLeft = data.time_left || data.timeLeft || 0;
        expireTime = new Date().getTime() + msLeft;
      }

      startCountdown(expireTime);
      document.getElementById('login-wrapper').classList.add('hidden');
      document.getElementById('robot-container').style.display = 'block';
      startRobot();
    } else {
      // Key hết hạn hoặc bị ban -> Xóa key lưu trong máy
      localStorage.removeItem("nexton_key");
    }
  } catch (e) { 
    console.error("Lỗi check Auth", e); 
  }
}

/* =========================================================
   KHỞI CHẠY ROBOT & API DỰ ĐOÁN
   ========================================================= */
function startRobot() {
  if(robotRunning) return;
  robotRunning = true;

  const LS_POS = "lc_robot_blue_pos";
  let pos = null, drag = null, powTimer = null;

  // Khôi phục vị trí kéo thả cũ
  try { const s = JSON.parse(localStorage.getItem(LS_POS)); if(s) pos = s; } catch(e){}
  function applyPos(){ root.style.left = pos.x + "px"; root.style.top = pos.y + "px"; }
  function clampPos(){ pos.x = Math.max(-30, Math.min(pos.x, innerWidth - 280)); pos.y = Math.max(-30, Math.min(pos.y, innerHeight - 150)); }
  
  if(!pos) { pos = { x: innerWidth - 322, y: innerHeight - 182 }; clampPos(); applyPos(); }
  addEventListener("resize", () => { if(pos){ clampPos(); applyPos(); } });

  // Hiệu ứng bùng nổ khi chạm
  function powerUp() {
    root.classList.remove("power"); 
    void root.offsetWidth; 
    root.classList.add("power");
    document.querySelectorAll("animate.capeanim").forEach(a => a.setAttribute("dur", "0.5s"));
    clearTimeout(powTimer); 
    powTimer = setTimeout(() => { 
      root.classList.remove("power"); 
      document.querySelectorAll("animate.capeanim").forEach(a => a.setAttribute("dur", "2.6s")); 
    }, 3100);
  }

  // Xử lý kéo thả
  root.addEventListener("pointerdown", e => { 
    drag = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false }; 
    root.setPointerCapture(e.pointerId); 
    root.style.zIndex = 51; 
  });
  
  root.addEventListener("pointermove", e => { 
    if(!drag) return; 
    if(Math.hypot(e.clientX-drag.sx, e.clientY-drag.sy)>4) drag.moved=true; 
    if(!drag.moved) return; 
    pos.x = e.clientX-drag.dx; 
    pos.y = e.clientY-drag.dy; 
    clampPos(); 
    applyPos(); 
  });
  
  function endDrag(){ 
    if(!drag) return; 
    const isTap = !drag.moved; 
    drag = null; 
    root.style.zIndex = 50; 
    try{ localStorage.setItem(LS_POS, JSON.stringify(pos)); }catch(e){}; 
    if(isTap) powerUp(); 
  }
  
  root.addEventListener("pointerup", endDrag); 
  root.addEventListener("pointercancel", endDrag);

  // Logic API dự đoán
  let shown = null, busy = false, latest = null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function present(d) {
    const side = d.du_doan === "TÀI" ? "tai" : "xiu";
    shown = { phien: d.phien, du_doan: d.du_doan };
    root.dataset.side = side;
    
    root.querySelector(".pred").textContent = d.du_doan;
    root.querySelector(".phien").textContent = "Phiên #" + d.phien;
    
    const conf = parseFloat(d.do_tin_cay) || 0;
    root.querySelector(".cv").textContent = conf.toFixed(1) + "%";
    root.querySelector(".cbar").style.width = conf + "%";
    
    root.dataset.mood = "show";
  }
  
  async function reactThenNext(won) {
    busy = true;
    await sleep(5000);
    root.dataset.mood = won ? "happy" : "sad";
    root.querySelector(".bt").textContent = won ? "Đúng rồi!" : "Tiếc quá…";
    await sleep(2400);
    busy = false;
    if(latest) present(latest); else { shown=null; root.dataset.mood="think"; }
  }

  function render(d) {
    if(!d || !d.du_doan) { latest = null; if(!busy){ shown=null; root.dataset.mood="think"; } return; }
    const duDoan = d.du_doan.toUpperCase();
    const normalized = { phien: d.phien, du_doan: duDoan, do_tin_cay: d.do_tin_cay };
    latest = normalized;

    if(shown && String(shown.phien) !== String(normalized.phien)) {
      const actual = (d.ket_qua || "").toUpperCase();
      if(actual.includes("TÀI") || actual.includes("XỈU")) {
        reactThenNext(actual.includes(shown.du_doan)); return;
      }
    }
    if(!busy) present(normalized);
  }

  async function poll() {
    try {
      const r = await fetch(API_PREDICT + "?t=" + Date.now());
      const j = await r.json();
      root.dataset.st = "";
      render(j);
    } catch(e) { 
      root.dataset.st = "err"; 
      if(!busy) root.dataset.mood="think"; 
    }
  }
  
  setInterval(poll, 3000);
  poll(); // Chạy ngay lần đầu
}

// Chạy check Auth khi vừa tải trang xong
window.onload = () => {
  checkAuth();
};
