// ===== Lấy tham số từ URL =====
const urlParams = new URLSearchParams(window.location.search);

// Tham số m: JSON chứa hot_box_str, latest_viewers_str
const paramM = urlParams.get('m') || '';

// Tham số r: chuỗi chứa coins, can_open, latest_viewers_str, end_time
const paramR = urlParams.get('r') || '';

// Tham số link: link tiktok (nếu có)
const tiktokLink = urlParams.get('link') || '';

// ===== Parse tham số m (JSON) =====
let mData = {};
try {
    if (paramM) {
        mData = JSON.parse(paramM);
    }
} catch (e) {
    mData = {};
}
const hotBoxStr = mData.hot_box_str || '🏅🇩🇪';
const latestViewersFromM = mData.latest_viewers_str || '';

// ===== Parse tham số r =====
// Định dạng: coins|can_open|latest_viewers_str|end_time|user
let coins = 80;
let canOpen = 25;
let latestViewersStr = '';
let endTime = 0; // end_time (giây)
let userName = '';

if (paramR) {
    const parts = paramR.split('|');
    if (parts.length >= 1 && parts[0]) coins = parseInt(parts[0]) || 0;
    if (parts.length >= 2 && parts[1]) canOpen = parseInt(parts[1]) || 0;
    if (parts.length >= 3) latestViewersStr = parts[2] || '';
    if (parts.length >= 4) endTime = parseInt(parts[3]) || 0;
    if (parts.length >= 5) userName = parts[4] || '';
}
// Ưu tiên latest_viewers_str từ m nếu có (viewer count thực tế)
if (latestViewersFromM) {
    latestViewersStr = latestViewersFromM;
}

// ===== Biến toàn cục =====
let timeOffset = 0; // Tổng thời gian đã điều chỉnh (giây), dương = tăng, âm = giảm
let link1 = null; // Link(1) người dùng nhập qua claimChangeBtn

// ===== DOM refs =====
const countdownEl = document.getElementById('countdown');
const progressEl = document.getElementById('progress');
const statusEl = document.getElementById('status');
const currentTimeEl = document.getElementById('currentTime');
const viewCountEl = document.getElementById('viewCount');
const peopleCountEl = document.getElementById('peopleCount');
const dTEl = document.getElementById('d-t');
const usfEl = document.querySelector('.usf b');
const hotBoxFlagEl = document.getElementById('hotBoxFlag');
const viewerDisplayEl = document.getElementById('viewerDisplay');

// ===== Hàm chuyển end_time (giây) thành hh:mm:ss =====
function formatEndTimeHHMMSS(timestampSec) {
    if (!timestampSec) return '--:--:--';
    const d = new Date(timestampSec * 1000);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return h + ':' + m + ':' + s;
}

// ===== Khởi tạo giá trị từ URL params =====
if (usfEl) usfEl.textContent = '@' + userName;
if (viewCountEl) viewCountEl.textContent = coins;
if (peopleCountEl) peopleCountEl.textContent = canOpen;

// Hiển thị hot_box_str (🏅🇹🇭) tại vị trí cờ
if (hotBoxFlagEl) hotBoxFlagEl.textContent = hotBoxStr;

// Hiển thị latest_viewers_str tại vị trí viewerDisplay
if (viewerDisplayEl && latestViewersStr) {
    viewerDisplayEl.textContent = '\u00A0 - \u00A0👀\u00A0' + latestViewersStr;
}

// Hiển thị end_time dạng hh:mm:ss tại currentTime
if (currentTimeEl) {
    currentTimeEl.textContent = formatEndTimeHHMMSS(endTime);
}

// ===== Hàm cập nhật hiển thị d-t (tổng offset) =====
function updateDTOffset() {
    if (!dTEl) return;
    const absVal = Math.abs(timeOffset);
    const sign = timeOffset >= 0 ? '+' : '-';
    const color = timeOffset >= 0 ? '#28a745' : '#dc3545'; // xanh lá nếu tăng, đỏ nếu giảm
    dTEl.innerHTML = '<b style="color:' + color + '">' + sign + absVal.toFixed(2) + 's</b>';
}

// ===== Hàm định dạng thời gian mm:ss:f (1 chữ số mili giây) =====
function formatTimeMMSSF(totalSeconds) {
    const absSec = Math.abs(totalSeconds);
    const minutes = Math.floor(absSec / 60);
    const seconds = Math.floor(absSec % 60);
    const milliseconds = Math.floor((absSec - Math.floor(absSec)) * 1000);
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const f = String(Math.floor(milliseconds / 100));
    return mm + ':' + ss + ':' + f;
}

// ===== Lấy thời gian hiện tại (ms) =====
function getCurrentTimeMs() {
    return Date.now();
}

// ===== Cập nhật đồng hồ đếm ngược =====
function updateClock() {
    if (!endTime) {
        // Nếu không có end_time, hiển thị 00:00:00
        if (countdownEl) countdownEl.textContent = '00:00:0';
        return;
    }

    const now = getCurrentTimeMs();
    const endTimeMs = endTime * 1000;
    // Áp dụng offset (timeOffset tính bằng giây)
    const adjustedEndMs = endTimeMs + timeOffset * 1000;
    const diffMs = adjustedEndMs - now;

    if (diffMs <= 0) {
        if (countdownEl) countdownEl.textContent = '00:00:0';
        if (progressEl) progressEl.style.width = '100%';
        if (statusEl) statusEl.textContent = '🎉 Rương đã mở!';
        return;
    }

    const diffSeconds = diffMs / 1000;
    if (countdownEl) countdownEl.textContent = formatTimeMMSSF(diffSeconds);

    // Cập nhật thanh tiến trình
    if (progressEl && endTimeMs > 0) {
        const totalMs = endTimeMs;
        const elapsedMs = now;
        const percent = Math.min(100, (elapsedMs / totalMs) * 100);
        progressEl.style.width = percent + '%';
    }

    // Cập nhật trạng thái
    if (statusEl) {
        statusEl.textContent = '⏳ Đang đếm ngược...';
    }
}

// ===== Cập nhật thời gian hiện tại - không còn dùng vì currentTime hiển thị end_time =====
function updateCurrentTime() {
    // currentTime giờ hiển thị end_time từ URL, không tự cập nhật
}

// ===== Điều chỉnh thời gian (offset) =====
function adjustTime(seconds) {
    timeOffset += seconds;
    updateDTOffset();
    // Cập nhật ngay đồng hồ
    updateClock();
}

// ===== Gán sự kiện nút điều chỉnh =====
document.getElementById('btn-decrease-0.05').addEventListener('click', function () {
    adjustTime(-0.05);
});
document.getElementById('btn-decrease-0.01').addEventListener('click', function () {
    adjustTime(-0.01);
});
document.getElementById('btn-increase-0.01').addEventListener('click', function () {
    adjustTime(0.01);
});
document.getElementById('btn-increase-0.05').addEventListener('click', function () {
    adjustTime(0.05);
});

// ===== Nút COPY (claimBtn) =====
document.getElementById('claimBtn').addEventListener('click', function () {
    // Sao chép link tiktok vào clipboard
    if (tiktokLink) {
        navigator.clipboard.writeText(tiktokLink).then(function () {
            // Đã copy
        }).catch(function () {
            // Không thể copy
        });
    }

    // Nếu có link(1), mở link(1) trong tab mới
    if (link1) {
        window.open(link1, '_blank');
    }
});

// ===== Nút + (claimChangeBtn) =====
document.getElementById('claimChangeBtn').addEventListener('click', function () {
    if (link1) {
        // Nếu đã có link(1), xóa link(1) đi
        link1 = null;
        alert('Đã xoá link(1)!');
    } else {
        // Nếu chưa có link(1), cho phép nhập link mới
        var input = prompt('Nhập link(1):');
        if (input && input.trim() !== '') {
            link1 = input.trim();
            alert('Đã lưu link(1): ' + link1);
        }
    }
});

// ===== Modal xác nhận =====
function handleConfirm(ok) {
    var modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = 'none';
    if (ok) {
        // Xác nhận OK
    }
}

// Gán sự kiện modal confirm qua event listener
var confirmCancelBtn = document.getElementById('confirmCancelBtn');
var confirmOkBtn = document.getElementById('confirmOkBtn');
if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', function () {
        handleConfirm(false);
    });
}
if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', function () {
        handleConfirm(true);
    });
}

// ===== Modal cấu hình màu sắc =====
document.getElementById('btn-open').addEventListener('click', function () {
    var modal = document.getElementById('modal');
    if (modal) modal.style.display = 'flex';
});

document.getElementById('btn-cancel').addEventListener('click', function () {
    var modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('btn-submit').addEventListener('click', function () {
    var start = parseFloat(document.getElementById('start_seconds').value) || 0;
    var end = parseFloat(document.getElementById('end_seconds').value) || 0;
    var color = document.getElementById('hex_background_color').value;
    document.body.style.backgroundColor = color;
    var modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
});

// ===== Đóng modal khi click ra ngoài =====
document.getElementById('modal').addEventListener('click', function (e) {
    if (e.target === this) {
        this.style.display = 'none';
    }
});

// ===== Khởi tạo =====
updateClock();
updateDTOffset();

// Cập nhật đồng hồ mỗi 10ms để hiển thị mili giây mượt
setInterval(updateClock, 10);

