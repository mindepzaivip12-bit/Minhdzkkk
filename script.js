/* =========================================================
   BON TOOL - LC79  |  script.js (Hoàn chỉnh - Đã cấu hình API)
   ========================================================= */

// ⚠️ ĐÃ CẬP NHẬT LINK API CỦA BẠN VÀO ĐÂY
const API_SERVER = "http://bontooltxios.gamer.gd/api";
const API_ACTIVATE = `${API_SERVER}/activate.php`;
const API_PREDICT  = `${API_SERVER}/predict.php`;

// =========================================================
// BIẾN TOÀN CỤC
// =========================================================
const root = document.getElementById("robot");
let isLoggingIn = false;
let robotRunning = false;
let countdownInterval = null;
let authToken = null;

// =========================================================
// 1. DÁN KEY
// =========================================================
async function pasteKey() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById("input-key").value = text.trim();
  } catch (err) {
    alert("Trình duyệt không cho phép dán tự động!");
  }
}

// =========================================================
// 2. ĐỒNG HỒ ĐẾM NGƯỢC
// =========================================================
function startCountdown(expiresAt) {
  clearInterval(countdownInterval);
  const timerEl  = document.getElementById("expiry-timer");
  const timeText = document.getElementById("time-text");
  if (!timerEl || !timeText) return;

  timerEl.classList.add("active");
  timerEl.classList.remove("warning");

  function update() {
    const msLeft = expiresAt - Date.now();
    
    // Nếu hết hạn
    if (isNaN(msLeft) || msLeft <= 0) {
      clearInterval(countdownInterval);
      timeText.innerText = "00:00:00";
      timerEl.classList.add("warning");
      localStorage.removeItem("nexton_key");
      localStorage.removeItem("nexton_token");
      document.getElementById("robot-container").style.display = "none";
      document.getElementById("login-wrapper").classList.remove("hidden");
      setTimeout(() => window.location.reload(), 2000);
      return;
    }
    
    const totalSecs = Math.floor(msLeft / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins  = Math.floor((totalSecs % 3600) / 60);
    const secs  = totalSecs % 60;
    timeText.innerText = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  update();
  countdownInterval = setInterval(update, 1000);
}

// =========================================================
// 3. XỬ LÝ ĐĂNG NHẬP
// =========================================================
async function handleActivate() {
  if (isLoggingIn) return;
  const key     = document.getElementById("input-key").value.trim();
  const btn     = document.getElementById("btn-submit");
  const btnText = document.getElementById("btnText");
  const errEl   = document.getElementById("error-msg");

  if (!key) {
    errEl.innerText = "Vui lòng nhập key!";
    errEl.style.display = "block";
    return;
  }

  isLoggingIn  = true;
  btn.disabled = true;
  btnText.innerText = "ĐANG XÁC THỰC...";
  errEl.style.display = "none";

  try {
    const res = await fetch(API_ACTIVATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    if (!res.ok) throw new Error(`Server trả về mã lỗi: ${res.status}`);

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("nexton_key", key);
      localStorage.setItem("nexton_token", data.token);
      authToken = data.token;

      let expireTime = data.expires_at ? new Date(data.expires_at).getTime() : 0;
      if (!expireTime && data.time_left > 0) expireTime = Date.now() + Number(data.time_left);
      if (!expireTime) expireTime = Date.now() + 3600 * 1000; // Fallback 1 tiếng

      startCountdown(expireTime);

      setTimeout(() => {
        document.getElementById("login-wrapper").classList.add("hidden");
        document.getElementById("robot-container").style.display = "block";
        startRobot();
      }, 800);
    } else {
      errEl.innerText = data.msg || "Key không hợp lệ!";
      errEl.style.display = "block";
      btn.disabled = false;
      btnText.innerText = "VÀO HỆ THỐNG";
    }
  } catch (e) {
    console.error("Lỗi Fetch API:", e);
    // Bắt lỗi chi tiết để dễ sửa
    if (e.message.includes("Failed to fetch")) {
      errEl.innerText = "Lỗi: Không kết nối được tới Server PHP (Sai link hoặc chặn CORS)!";
    } else if (e.message.includes("404")) {
      errEl.innerText = "Lỗi 404: Không tìm thấy file activate.php!";
    } else {
      errEl.innerText = e.message;
    }
    errEl.style.display = "block";
    btn.disabled = false;
    btnText.innerText = "VÀO HỆ THỐNG";
  } finally {
    isLoggingIn = false;
  }
}

// =========================================================
// 4. TỰ ĐỘNG ĐĂNG NHẬP (KHI F5)
// =========================================================
async function checkAuth() {
  const savedKey = localStorage.getItem("nexton_key");
  if (!savedKey) return;

  try {
    const res = await fetch(API_ACTIVATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: savedKey }),
    });
    if (!res.ok) return;
    
    const data = await res.json();
    if (data.success) {
      authToken = data.token;
      localStorage.setItem("nexton_token", data.token);
      let expireTime = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 3600*1000;
      
      startCountdown(expireTime);
      document.getElementById("login-wrapper").classList.add("hidden");
      document.getElementById("robot-container").style.display = "block";
      startRobot();
    } else {
      localStorage.removeItem("nexton_key");
    }
  } catch (e) {
    console.error("Lỗi Check Auth:", e);
  }
}

// =========================================================
// 5. KHỞI CHẠY ROBOT & DỰ ĐOÁN
// =========================================================
function startRobot() {
  if (robotRunning) return;
  robotRunning = true;

  const LS_POS = "lc_robot_blue_pos";
  let pos = null, drag = null, powTimer = null;

  // --- Setup vị trí ---
  try { const s = JSON.parse(localStorage.getItem(LS_POS)); if(s) pos = s; } catch(e){}
  function applyPos(){ root.style.left = pos.x + "px"; root.style.top = pos.y + "px"; }
  function clampPos(){ pos.x = Math.max(-30, Math.min(pos.x, innerWidth - 280)); pos.y = Math.max(-30, Math.min(pos.y, innerHeight - 150)); }
  
  if(!pos) { pos = { x: innerWidth - 322, y: innerHeight - 182 }; clampPos(); applyPos(); }
  addEventListener("resize", () => { if(pos){ clampPos(); applyPos(); } });

  // --- Hiệu ứng chạm ---
  function powerUp() {
    root.classList.remove("power"); void root.offsetWidth; root.classList.add("power");
    document.querySelectorAll("animate.capeanim").forEach(a => a.setAttribute("dur", "0.5s"));
    clearTimeout(powTimer); powTimer = setTimeout(() => { root.classList.remove("power"); document.querySelectorAll("animate.capeanim").forEach(a => a.setAttribute("dur", "2.6s")); }, 3100);
  }

  // --- Kéo thả ---
  root.addEventListener("pointerdown", e => { drag = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false }; root.setPointerCapture(e.pointerId); root.style.zIndex = 51; });
  root.addEventListener("pointermove", e => { if(!drag) return; if(Math.hypot(e.clientX-drag.sx, e.clientY-drag.sy)>4) drag.moved=true; if(!drag.moved) return; pos.x = e.clientX-drag.dx; pos.y = e.clientY-drag.dy; clampPos(); applyPos(); });
  function endDrag(){ if(!drag) return; const isTap = !drag.moved; drag = null; root.style.zIndex = 50; try{ localStorage.setItem(LS_POS, JSON.stringify(pos)); }catch(e){}; if(isTap) powerUp(); }
  root.addEventListener("pointerup", endDrag); root.addEventListener("pointercancel", endDrag);

  // --- Logic Dự đoán ---
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
    const payload = d.data || d; // Chấp nhận data từ PHP trả về
    if (!payload.phien || !payload.du_doan) return;

    const normalized = { phien: payload.phien, du_doan: String(payload.du_doan).toUpperCase(), do_tin_cay: payload.do_tin_cay };
    latest = normalized;

    if(shown && String(shown.phien) !== String(normalized.phien)) {
      const actual = String(payload.ket_qua || "").toUpperCase();
      if(actual.includes("TÀI") || actual.includes("XỈU")) { reactThenNext(actual.includes(shown.du_doan)); return; }
    }
    if(!busy) present(normalized);
  }

  // --- Gọi API liên tục ---
  async function poll() {
    try {
      const token = authToken || localStorage.getItem("nexton_token") || "";
      const r = await fetch(API_PREDICT + "?t=" + Date.now(), {
        headers: { "X-Auth-Token": token }
      });
      
      if (r.status === 401 || r.status === 403) {
        // Token sai hoặc Key bị ban -> đá ra ngoài
        localStorage.removeItem("nexton_key"); localStorage.removeItem("nexton_token"); location.reload(); return;
      }
      
      const j = await r.json();
      root.dataset.st = "";
      render(j);
    } catch(e) { 
      root.dataset.st = "err"; 
      if(!busy) root.dataset.mood="think"; 
    }
  }
  setInterval(poll, 3000);
  poll();
}

// =========================================================
// 6. CHẠY KHI TẢI TRANG
// =========================================================
window.addEventListener("load", () => { 
  checkAuth(); 
});
