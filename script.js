/* =========================================================
   BON TOOL - LC79  |  script.js (API đã tách sang PHP)
   ========================================================= */

// ⚠️ ĐỔI LINK NÀY THÀNH LINK PHP CỦA BẠN
const API_SERVER = "http://bontooltxios.gamer.gd/api";";

const API_ACTIVATE = `${API_SERVER}/activate.php`;
const API_PREDICT  = `${API_SERVER}/predict.php`;

// =========================================================
// BIẾN TOÀN CỤC
// =========================================================
const root = document.getElementById("robot");
const expiryEl = document.getElementById("expiry-timer");

let isLoggingIn = false;
let robotRunning = false;
let countdownInterval = null;
let authToken = null;
let currentKey = null;

// =========================================================
// 1. DÁN KEY TỰ ĐỘNG
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
    const now     = Date.now();
    const msLeft  = expiresAt - now;

    if (isNaN(msLeft) || msLeft <= 0) {
      clearInterval(countdownInterval);
      timeText.innerText = "00:00:00";
      timerEl.classList.add("warning");

      // Xoá phiên
      localStorage.removeItem("nexton_key");
      localStorage.removeItem("nexton_token");
      authToken = null;
      currentKey = null;

      document.getElementById("robot-container").style.display = "none";
      document.getElementById("login-wrapper").classList.remove("hidden");

      setTimeout(() => window.location.reload(), 2000);
      return;
    }

    const totalSecs = Math.floor(msLeft / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins  = Math.floor((totalSecs % 3600) / 60);
    const secs  = totalSecs % 60;

    timeText.innerText =
      `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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
  btnText.innerText = "ĐANG XÁC THỰC";
  errEl.style.display = "none";

  try {
    const res = await fetch(API_ACTIVATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    const data = await res.json();

    if (data.success) {
      // Lưu key + token
      localStorage.setItem("nexton_key", key);
      localStorage.setItem("nexton_token", data.token);
      authToken  = data.token;
      currentKey = key;

      // Tính thời gian hết hạn
      let expireTime = 0;
      if (data.expires_at) {
        const parsed = new Date(data.expires_at).getTime();
        if (!isNaN(parsed)) expireTime = parsed;
      }
      if (!expireTime && data.time_left > 0) {
        expireTime = Date.now() + Number(data.time_left);
      }
      if (!expireTime) {
        // fallback: 1 giờ nếu server không trả
        expireTime = Date.now() + 3600 * 1000;
      }

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
    console.error("Activate error:", e);
    errEl.innerText = "Lỗi kết nối Server!";
    errEl.style.display = "block";
    btn.disabled = false;
    btnText.innerText = "VÀO HỆ THỐNG";
  } finally {
    isLoggingIn = false;
  }
}

// =========================================================
// 4. AUTO LOGIN KHI TẢI LẠI TRANG
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

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("nexton_key");
        localStorage.removeItem("nexton_token");
      }
      return;
    }

    const data = await res.json();

    if (data.success) {
      authToken  = data.token;
      currentKey = savedKey;
      localStorage.setItem("nexton_token", data.token);

      let expireTime = 0;
      if (data.expires_at) {
        const parsed = new Date(data.expires_at).getTime();
        if (!isNaN(parsed)) expireTime = parsed;
      }
      if (!expireTime && data.time_left > 0) {
        expireTime = Date.now() + Number(data.time_left);
      }
      if (!expireTime) expireTime = Date.now() + 3600 * 1000;

      startCountdown(expireTime);

      document.getElementById("login-wrapper").classList.add("hidden");
      document.getElementById("robot-container").style.display = "block";
      startRobot();
    } else {
      localStorage.removeItem("nexton_key");
      localStorage.removeItem("nexton_token");
    }
  } catch (e) {
    console.error("Check auth error:", e);
  }
}

// =========================================================
// 5. KHỞI CHẠY ROBOT + DỰ ĐOÁN
// =========================================================
function startRobot() {
  if (robotRunning) return;
  robotRunning = true;

  const LS_POS = "lc_robot_blue_pos";
  let pos = null;
  let drag = null;
  let powTimer = null;

  // --- Khôi phục vị trí robot ---
  try {
    const s = JSON.parse(localStorage.getItem(LS_POS));
    if (s && typeof s.x === "number" && typeof s.y === "number") pos = s;
  } catch (e) {}

  function applyPos() {
    root.style.left = pos.x + "px";
    root.style.top  = pos.y + "px";
  }
  function clampPos() {
    pos.x = Math.max(-30, Math.min(pos.x, innerWidth  - 280));
    pos.y = Math.max(-30, Math.min(pos.y, innerHeight - 150));
  }

  if (!pos) {
    pos = { x: innerWidth - 322, y: innerHeight - 182 };
    clampPos();
    applyPos();
  }

  addEventListener("resize", () => {
    if (pos) { clampPos(); applyPos(); }
  });

  // --- Hiệu ứng power-up khi tap ---
  function powerUp() {
    root.classList.remove("power");
    void root.offsetWidth;
    root.classList.add("power");

    document.querySelectorAll("animate.capeanim").forEach((a) =>
      a.setAttribute("dur", "0.5s")
    );

    clearTimeout(powTimer);
    powTimer = setTimeout(() => {
      root.classList.remove("power");
      document.querySelectorAll("animate.capeanim").forEach((a) =>
        a.setAttribute("dur", "2.6s")
      );
    }, 3100);
  }

  // --- Kéo thả robot ---
  root.addEventListener("pointerdown", (e) => {
    drag = {
      dx: e.clientX - pos.x,
      dy: e.clientY - pos.y,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
    };
    root.setPointerCapture(e.pointerId);
    root.style.zIndex = 51;
  });

  root.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) {
      drag.moved = true;
    }
    if (!drag.moved) return;
    pos.x = e.clientX - drag.dx;
    pos.y = e.clientY - drag.dy;
    clampPos();
    applyPos();
  });

  function endDrag() {
    if (!drag) return;
    const isTap = !drag.moved;
    drag = null;
    root.style.zIndex = 50;
    try {
      localStorage.setItem(LS_POS, JSON.stringify(pos));
    } catch (e) {}
    if (isTap) powerUp();
  }

  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);

  // --- Biến trạng thái ---
  let shown  = null;   // { phien, du_doan } đang hiển thị
  let busy   = false;  // đang trong animation react
  let latest = null;   // dữ liệu mới nhất từ server

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // --- Hiển thị dự đoán ---
  function present(d) {
    const side = d.du_doan === "TÀI" ? "tai" : "xiu";
    shown = { phien: d.phien, du_doan: d.du_doan };

    root.dataset.side = side;
    root.querySelector(".pred").textContent  = d.du_doan;
    root.querySelector(".phien").textContent = "Phiên #" + d.phien;

    const conf = parseFloat(d.do_tin_cay) || 0;
    root.querySelector(".cv").textContent   = conf.toFixed(1) + "%";
    root.querySelector(".cbar").style.width = conf + "%";

    root.dataset.mood = "show";
  }

  // --- Phản ứng khi có kết quả ---
  async function reactThenNext(won) {
    busy = true;
    await sleep(5000);
    root.dataset.mood = won ? "happy" : "sad";
    root.querySelector(".bt").textContent = won ? "Đúng rồi!" : "Tiếc quá…";
    await sleep(2400);
    busy = false;
    if (latest) {
      present(latest);
    } else {
      shown = null;
      root.dataset.mood = "think";
    }
  }

  // --- Render dữ liệu mới ---
  function render(d) {
    if (!d || !d.du_doan) {
      latest = null;
      if (!busy) {
        shown = null;
        root.dataset.mood = "think";
      }
      return;
    }

    // API PHP có thể trả về { success, data } hoặc trực tiếp { phien, du_doan }
    const payload = d.data || d;

    if (!payload.phien || !payload.du_doan) {
      return;
    }

    const duDoan = String(payload.du_doan).toUpperCase();
    const normalized = {
      phien: payload.phien,
      du_doan: duDoan,
      do_tin_cay: payload.do_tin_cay,
    };
    latest = normalized;

    // Phát hiện phiên mới → check kết quả phiên cũ
    if (shown && String(shown.phien) !== String(normalized.phien)) {
      const actual = String(payload.ket_qua || "").toUpperCase();
      if (actual.includes("TÀI") || actual.includes("XỈU")) {
        reactThenNext(actual.includes(shown.du_doan));
        return;
      }
    }

    if (!busy) present(normalized);
  }

  // --- Poll API ---
  async function poll() {
    try {
      const token = authToken || localStorage.getItem("nexton_token") || "";
      const r = await fetch(API_PREDICT + "?t=" + Date.now(), {
        headers: { "X-Auth-Token": token },
      });

      if (r.status === 401 || r.status === 403) {
        // Token hết hạn / key bị ban → về login
        localStorage.removeItem("nexton_key");
        localStorage.removeItem("nexton_token");
        location.reload();
        return;
      }

      const j = await r.json();
      root.dataset.st = "";
      render(j);
    } catch (e) {
      root.dataset.st = "err";
      if (!busy) root.dataset.mood = "think";
    }
  }

  setInterval(poll, 3000);
  poll();
}

// =========================================================
// 6. KHỞI ĐỘNG
// =========================================================
window.addEventListener("load", () => {
  checkAuth();
});
