// ===== Lấy tham số từ URL =====
const urlParams = new URLSearchParams(window.location.search);

// Tham số m: user (tên người dùng)
const paramM = urlParams.get('m') || 'user';

// Tham số r: chuỗi chứa coins|can_open|hot_box_str|latest_viewers_str|end_time
const paramR = urlParams.get('r') || '';

// Tham số link: link tiktok (nếu có)
const tiktokLink = urlParams.get('link') || '';

// ===== Parse tham số r =====
// Định dạng: coins|can_open|hot_box_str|latest_viewers_str|end_time
let coins = 80;
let canOpen = 25;
let hotBoxStr = '🏅🇩🇪';
let latestViewersStr = '';
let endTime = 0; // end_time (giây)

if (paramR) {
    const parts = paramR.split('|');
    if (parts.length >= 1 && parts[0]) coins = parseInt(parts[0]) || 0;
    if (parts.length >= 2 && parts[1]) canOpen = parseInt(parts[1]) || 0;
    if (parts.length >= 3) hotBoxStr = parts[2] || '🏅🇩🇪';
    if (parts.length >= 4) latestViewersStr = parts[3] || '';
    if (parts.length >= 5) endTime = parseInt(parts[4]) || 0;
}

// ===== Biến toàn cục =====
let timeOffset = 0; // Tổng thời gian đã điều chỉnh (giây), dương = tăng, âm = giảm
let link1 = null; // Link(1) người dùng nhập qua claimChangeBtn

// ===== Device ID & localStorage =====
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

var deviceId = '';

// Khôi phục / tạo Device ID
(function initDeviceId() {
    try {
        var testKey = '__test_ls__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);

        deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = generateUUID();
            localStorage.setItem('deviceId', deviceId);
        }
    } catch (e) {
        deviceId = 'local-' + generateUUID();
    }
})();

// Hiển thị device ID
var deviceIdEl = document.getElementById('deviceIdDisplay');
if (deviceIdEl) {
    deviceIdEl.textContent = 'ID: ' + deviceId.slice(0, 8) + '...';
    deviceIdEl.title = deviceId; // Full ID khi hover
}

// Khôi phục cấu hình đã lưu
(function loadSavedState() {
    try {
        var testKey = '__test_ls__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);

        var savedOffset = localStorage.getItem('timeOffset');
        if (savedOffset !== null && savedOffset !== undefined) {
            timeOffset = parseFloat(savedOffset);
            if (isNaN(timeOffset)) timeOffset = 0;
        }

        var savedLink1 = localStorage.getItem('link1');
        if (savedLink1 && savedLink1 !== 'null' && savedLink1 !== 'undefined') {
            link1 = savedLink1;
        }

        var savedBgColor = localStorage.getItem('bgColor');
        if (savedBgColor) {
            document.body.style.backgroundColor = savedBgColor;
        }
    } catch (e) {
        // localStorage không khả dụng, giữ giá trị mặc định
    }
})();

// ===== DOM refs =====
const countdownEl = document.getElementById('countdown');
const progressEl = document.getElementById('progress');
const endTimeDisplayEl = document.getElementById('endTimeDisplay');
const viewCountEl = document.getElementById('viewCount');
const peopleCountEl = document.getElementById('peopleCount');
const dTEl = document.getElementById('d-t');
const usernameDisplayEl = document.getElementById('usernameDisplay');
const hotBoxFlagEl = document.getElementById('hotBoxFlag');
const viewersDisplayEl = document.getElementById('viewersDisplay');

// ===== Khởi tạo giá trị từ URL params =====
if (usernameDisplayEl) usernameDisplayEl.textContent = '@' + paramM;
if (viewCountEl) viewCountEl.textContent = coins;
if (peopleCountEl) peopleCountEl.textContent = canOpen;
if (hotBoxFlagEl) hotBoxFlagEl.textContent = hotBoxStr;
if (viewersDisplayEl) viewersDisplayEl.textContent = latestViewersStr;

// Hàm định dạng timestamp (giây) thành hh:mm:ss
function formatEndTimeHHMMSS(timestampSeconds) {
    if (!timestampSeconds) return '--:--:--';
    const date = new Date(timestampSeconds * 1000);
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return h + ':' + m + ':' + s;
}

// Hiển thị thời gian kết thúc
if (endTimeDisplayEl) {
    endTimeDisplayEl.textContent = formatEndTimeHHMMSS(endTime);
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
function formatTime(ms) {
    let totalSeconds = Math.floor(ms / 1000);
    let milliseconds = Math.floor(ms % 1000);
    
    // Đảm bảo mili giây luôn có 3 chữ số
    let msStr = milliseconds.toString().padStart(3, '0');
    
    // Định dạng Giây:Mili
    return `${totalSeconds}:${msStr}`;
}

// ===== Lấy thời gian hiện tại (ms) =====
function getCurrentTimeMs() {
    return Date.now();
}

// ===== Cập nhật đồng hồ đếm ngược =====
function updateClock() {
    if (!endTime) {
        // Nếu không có end_time, hiển thị 00:00:0
        if (countdownEl) countdownEl.textContent = '00:00:0';
        if (progressEl) progressEl.style.width = '0%';
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
        return;
    }

    const diffSeconds = diffMs / 1000;
    if (countdownEl) countdownEl.textContent = formatTimeMMSSF(diffSeconds);

    // Cập nhật thanh tiến trình: thời gian đã trôi qua / tổng thời gian
    // Tổng thời gian = endTimeMs (từ epoch 0 đến end_time)
    // Thời gian đã trôi qua = now (từ epoch 0 đến hiện tại)
    if (progressEl && endTimeMs > 0) {
        const totalMs = endTimeMs;
        const elapsedMs = now;
        const percent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
        progressEl.style.width = percent + '%';
    }

}

// ===== Điều chỉnh thời gian (offset) =====
function adjustTime(seconds) {
    timeOffset += seconds;
    // Làm tròn 2 chữ số thập phân để tránh sai số
    timeOffset = Math.round(timeOffset * 100) / 100;
    // Lưu vào localStorage
    try {
        localStorage.setItem('timeOffset', String(timeOffset));
    } catch (e) {}
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

    // Nếu có link(1), mở link(1) trong tab mới rồi đóng ngay (trong nền)
    if (link1) {
        // Cách 1: Dùng fetch gửi request trong nền (đảm bảo server nhận được)
        fetch(link1, { mode: 'no-cors' }).catch(function () {
            // fetch có thể bị chặn CORS, không sao
        });

        // Cách 2: Mở tab mới và đóng sau 50ms (gần như tức thì, hoạt động trong nền)
        try {
            var newTab = window.open(link1, '_blank');
            if (newTab) {
                setTimeout(function () {
                    try { newTab.close(); } catch (e) { /* tab đã đóng hoặc không thể đóng */ }
                }, 50);
            }
        } catch (e) {
            // Trình duyệt chặn popup, bỏ qua
        }
    }
});

// ===== Nút + (claimChangeBtn) =====
document.getElementById('claimChangeBtn').addEventListener('click', function () {
    if (link1) {
        // Nếu đã có link(1), xóa link(1) đi
        link1 = null;
        try { localStorage.removeItem('link1'); } catch (e) {}
        alert('Đã xoá link(1)!');
    } else {
        // Nếu chưa có link(1), cho phép nhập link mới
        var input = prompt('Nhập link(1):');
        if (input && input.trim() !== '') {
            link1 = input.trim();
            try { localStorage.setItem('link1', String(link1)); } catch (e) {}
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
    try { localStorage.setItem('bgColor', color); } catch (e) {}
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
