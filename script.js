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
let timeOffset = 0; 
let link1 = null; 

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
    } catch (e) {}
})();

// ===== DOM refs =====
const countdownEl = document.getElementById('countdown');
const endTimeDisplayEl = document.getElementById('endTimeDisplay');
const viewCountEl = document.getElementById('viewCount');
const peopleCountEl = document.getElementById('peopleCount');
const dTEl = document.getElementById('d-t');
const usernameDisplayEl = document.getElementById('usernameDisplay');
const hotBoxFlagEl = document.getElementById('hotBoxFlag');
const viewersDisplayEl = document.getElementById('viewersDisplay');

// ===== Khởi tạo giá trị từ URL params =====
if (usernameDisplayEl) usernameDisplayEl.textContent = paramM;
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
    // Chữ màu đen giữ nguyên sự tối giản như trong ảnh
    dTEl.innerHTML = '<b style="color:#2c3e50">' + sign + absVal.toFixed(2) + 's</b>';
}

// ===== Hàm định dạng thời gian ss.f =====
function formatTimeMMSSF(totalSeconds) {
    const absSec = Math.abs(totalSeconds);
    const seconds = Math.floor(absSec);
    const milliseconds = Math.floor((absSec - Math.floor(absSec)) * 1000);
    const f = String(Math.floor(milliseconds / 100));
    return String(seconds) + '.' + f; // Chuyển dấu : thành dấu .
}

// ===== Lấy thời gian hiện tại (ms) =====
function getCurrentTimeMs() {
    return Date.now();
}

// ===== Cập nhật đồng hồ đếm ngược =====
function updateClock() {
    if (!endTime) {
        if (countdownEl) countdownEl.textContent = '00.0';
        return;
    }

    const now = getCurrentTimeMs();
    const endTimeMs = endTime * 1000;
    const adjustedEndMs = endTimeMs + timeOffset * 1000;
    const diffMs = adjustedEndMs - now;

    if (diffMs <= 0) {
        if (countdownEl) countdownEl.textContent = '00.0';
        return;
    }

    const diffSeconds = diffMs / 1000;
    if (countdownEl) countdownEl.textContent = formatTimeMMSSF(diffSeconds);
}

// ===== Điều chỉnh thời gian (offset) =====
function adjustTime(seconds) {
    timeOffset += seconds;
    timeOffset = Math.round(timeOffset * 100) / 100;
    try {
        localStorage.setItem('timeOffset', String(timeOffset));
    } catch (e) {}
    updateDTOffset();
    updateClock();
}

// ===== Gán sự kiện nút điều chỉnh =====
document.getElementById('btn-decrease-0.05').addEventListener('click', function () { adjustTime(-0.05); });
document.getElementById('btn-decrease-0.01').addEventListener('click', function () { adjustTime(-0.01); });
document.getElementById('btn-increase-0.01').addEventListener('click', function () { adjustTime(0.01); });
document.getElementById('btn-increase-0.05').addEventListener('click', function () { adjustTime(0.05); });

// ===== Nút COPY (claimBtn) =====
document.getElementById('claimBtn').addEventListener('click', function () {
    if (tiktokLink) {
        navigator.clipboard.writeText(tiktokLink).catch(function () {});
    }

    if (link1) {
        fetch(link1, { mode: 'no-cors' }).catch(function () {});
        try {
            var newTab = window.open(link1, '_blank');
            if (newTab) {
                setTimeout(function () {
                    try { newTab.close(); } catch (e) {}
                }, 50);
            }
        } catch (e) {}
    }
});

// ===== Nút + (claimChangeBtn) =====
document.getElementById('claimChangeBtn').addEventListener('click', function () {
    if (link1) {
        link1 = null;
        try { localStorage.removeItem('link1'); } catch (e) {}
        alert('Đã xoá link(1)!');
    } else {
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
}

var confirmCancelBtn = document.getElementById('confirmCancelBtn');
var confirmOkBtn = document.getElementById('confirmOkBtn');
if (confirmCancelBtn) { confirmCancelBtn.addEventListener('click', function () { handleConfirm(false); }); }
if (confirmOkBtn) { confirmOkBtn.addEventListener('click', function () { handleConfirm(true); }); }

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
    var color = document.getElementById('hex_background_color').value;
    document.body.style.backgroundColor = color;
    try { localStorage.setItem('bgColor', color); } catch (e) {}
    var modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('modal').addEventListener('click', function (e) {
    if (e.target === this) {
        this.style.display = 'none';
    }
});

// ===== Khởi tạo =====
updateClock();
updateDTOffset();

setInterval(updateClock, 10);
