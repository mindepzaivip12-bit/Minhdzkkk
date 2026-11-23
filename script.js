/* =========================================================
   BON TOOL - LC79 (Bản Full - Đã fix CORS & SSL)
   ========================================================= */

const API_SERVER = "https://lc79vipadmin-5orx.onrender.com/api"; // ⚠️ SỬA LINK NÀY
const API_ACTIVATE = `${API_SERVER}/activate.php`;
const API_PREDICT  = `${API_SERVER}/predict.php`;

const root = document.getElementById("robot");
let isLoggingIn = false, robotRunning = false, countdownInterval = null, authToken = null;

async function pasteKey() {
  try { document.getElementById("input-key").value = (await navigator.clipboard.readText()).trim(); } 
  catch (err) { alert("Trình duyệt không cho phép dán!"); }
}

function startCountdown(expiresAt) {
  clearInterval(countdownInterval);
  const timerEl  = document.getElementById("expiry-timer");
  const timeText = document.getElementById("time-text");
  if (!timerEl || !timeText) return;

  timerEl.classList.add("active"); timerEl.classList.remove("warning");

  function update() {
    const msLeft = expiresAt - Date.now();
    if (isNaN(msLeft) || msLeft <= 0) {
      clearInterval(countdownInterval); timeText.innerText = "00:00:00"; timerEl.classList.add("warning");
      localStorage.removeItem("nexton_key"); localStorage.removeItem("nexton_token");
      document.getElementById("robot-container").style.display = "none";
      document.getElementById("login-wrapper").classList.remove("hidden");
      setTimeout(() => window.location.reload(), 2000); return;
    }
    const s = Math.floor(msLeft/1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    timeText.innerText = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  }
  update(); countdownInterval = setInterval(update, 1000);
}

async function handleActivate() {
  if (isLoggingIn) return;
  const key = document.getElementById("input-key").value.trim();
  const btn = document.getElementById("btn-submit"), btnText = document.getElementById("btnText"), errEl = document.getElementById("error-msg");

  if (!key) { errEl.innerText = "Vui lòng nhập key!"; errEl.style.display = "block"; return; }

  isLoggingIn = true; btn.disabled = true; btnText.innerText = "ĐANG XÁC THỰC..."; errEl.style.display = "none";

  try {
    const res = await fetch(API_ACTIVATE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    if (!res.ok) throw new Error(`Mã lỗi: ${res.status}`);
    
    const data = await res.json();
    if (data.success) {
      localStorage.setItem("nexton_key", key);
      localStorage.setItem("nexton_token", data.token);
      authToken = data.token;

      let expireTime = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 3600000;
      startCountdown(expireTime);

      setTimeout(() => {
        document.getElementById("login-wrapper").classList.add("hidden");
        document.getElementById("robot-container").style.display = "block";
        startRobot();
      }, 800);
    } else {
      errEl.innerText = data.msg || "Key không hợp lệ!"; errEl.style.display = "block";
      btn.disabled = false; btnText.innerText = "VÀO HỆ THỐNG";
    }
  } catch (e) {
    errEl.innerText = e.message.includes("Failed to fetch") ? "Không kết nối được tới Server PHP!" : e.message;
    errEl.style.display = "block"; btn.disabled = false; btnText.innerText = "VÀO HỆ THỐNG";
  } finally { isLoggingIn = false; }
}

async function checkAuth() {
  const savedKey = localStorage.getItem("nexton_key");
  if (!savedKey) return;
  try {
    const res = await fetch(API_ACTIVATE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: savedKey }) });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      authToken = data.token;
      startCountdown(data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 3600000);
      document.getElementById("login-wrapper").classList.add("hidden");
      document.getElementById("robot-container").style.display = "block";
      startRobot();
    } else { localStorage.removeItem("nexton_key"); }
  } catch (e) { console.error(e); }
}

function startRobot() {
  if (robotRunning) return; robotRunning = true;
  const LS_POS = "lc_robot_blue_pos";
  let pos = null, drag = null, powTimer = null;

  try { const s = JSON.parse(localStorage.getItem(LS_POS)); if(s) pos = s; } catch(e){}
  function applyPos(){ root.style.left = pos.x + "px"; root.style.top = pos.y + "px"; }
  function clampPos(){ pos.x = Math.max(-30, Math.min(pos.x, innerWidth - 280)); pos.y = Math.max(-30, Math.min(pos.y, innerHeight - 150)); }
  if(!pos) { pos = { x: innerWidth - 322, y: innerHeight - 182 }; clampPos(); applyPos(); }
  addEventListener("resize", () => { if(pos){ clampPos(); applyPos(); } });

  function powerUp() {
    root.classList.remove("power"); void root.offsetWidth; root.classList.add("power");
    document.querySelectorAll("animate.capeanim").forEach(a => a.setAttribute("dur", "0.5s"));
    clearTimeout(powTimer); powTimer = setTimeout(() => { root.classList.remove("power"); document.querySelectorAll("animate.capeanim").forEach(a => a.setAttribute("dur", "2.6s")); }, 3100);
  }

  root.addEventListener("pointerdown", e => { drag = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false }; root.setPointerCapture(e.pointerId); root.style.zIndex = 51; });
  root.addEventListener("pointermove", e => { if(!drag) return; if(Math.hypot(e.clientX-drag.sx, e.clientY-drag.sy)>4) drag.moved=true; if(!drag.moved) return; pos.x = e.clientX-drag.dx; pos.y = e.clientY-drag.dy; clampPos(); applyPos(); });
  function endDrag(){ if(!drag) return; const isTap = !drag.moved; drag = null; root.style.zIndex = 50; try{ localStorage.setItem(LS_POS, JSON.stringify(pos)); }catch(e){}; if(isTap) powerUp(); }
  root.addEventListener("pointerup", endDrag); root.addEventListener("pointercancel", endDrag);

  let shown = null, busy = false, latest = null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function present(d) {
    shown = { phien: d.phien, du_doan: d.du_doan };
    root.dataset.side = d.du_doan === "TÀI" ? "tai" : "xiu";
    root.querySelector(".pred").textContent = d.du_doan;
    root.querySelector(".phien").textContent = "Phiên #" + d.phien;
    const conf = parseFloat(d.do_tin_cay) || 0;
    root.querySelector(".cv").textContent = conf.toFixed(1) + "%";
    root.querySelector(".cbar").style.width = conf + "%";
    root.dataset.mood = "show";
  }
  
  async function reactThenNext(won) {
    busy = true; await sleep(5000);
    root.dataset.mood = won ? "happy" : "sad";
    root.querySelector(".bt").textContent = won ? "Đúng rồi!" : "Tiếc quá…";
    await sleep(2400); busy = false;
    if(latest) present(latest); else { shown=null; root.dataset.mood="think"; }
  }

  function render(d) {
    if(!d || !d.du_doan) { latest = null; if(!busy){ shown=null; root.dataset.mood="think"; } return; }
    const payload = d.data || d;
    if (!payload.phien || !payload.du_doan) return;
    const normalized = { phien: payload.phien, du_doan: String(payload.du_doan).toUpperCase(), do_tin_cay: payload.do_tin_cay };
    latest = normalized;
    if(shown && String(shown.phien) !== String(normalized.phien)) {
      const actual = String(payload.ket_qua || "").toUpperCase();
      if(actual.includes("TÀI") || actual.includes("XỈU")) { reactThenNext(actual.includes(shown.du_doan)); return; }
    }
    if(!busy) present(normalized);
  }

  async function poll() {
    try {
      const token = authToken || localStorage.getItem("nexton_token") || "";
      const r = await fetch(API_PREDICT + "?t=" + Date.now(), { headers: { "X-Auth-Token": token } });
      if (r.status === 401 || r.status === 403) { localStorage.removeItem("nexton_key"); localStorage.removeItem("nexton_token"); location.reload(); return; }
      const j = await r.json(); root.dataset.st = ""; render(j);
    } catch(e) { root.dataset.st = "err"; if(!busy) root.dataset.mood="think"; }
  }
  setInterval(poll, 3000); poll();
}

window.addEventListener("load", () => checkAuth());
