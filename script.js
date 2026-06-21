// ===== Lấy tham số từ URL =====
const urlParams = new URLSearchParams(window.location.search);

const paramM = urlParams.get('m') || 'user';
const paramR = urlParams.get('r') || '';
const tiktokLink = urlParams.get('link') || '';

// ===== Parse tham số r =====
let coins = 80;
let canOpen = 25;
let hotBoxStr = '🏅🇩🇪';
let latestViewersStr = '';
let endTime = 0; 

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

// ===== CẤU HÌNH NHÁY MÀU NỀN THEO THỜI GIAN =====
let colorConfig = {
    active: false,
    start: 0.6,
    end: 0.0,
    color: '#ff0000'
};
let currentBgState = 'default'; // Trạng thái nền: 'default' (Mặc định) hoặc 'flash' (Đang chớp màu)

// Hàm thay đổi trạng thái màu nền và tự động chỉnh màu chữ Trắng/Đen
function applyBackgroundColor(state, colorHex = '') {
    if (state === 'default') {
        // Trả về nền mặc định (Xám sáng)
        document.body.style.backgroundColor = 'var(--bg-color)';
        document.documentElement.style.setProperty('--text-main', '#2c3e50');
        document.documentElement.style.setProperty('--text-muted', '#596275');
    } else if (state === 'flash') {
        // Áp dụng màu nháy người dùng đã chọn
        document.body.style.backgroundColor = colorHex;
        
        // Thuật toán YIQ tự động đổi màu chữ cho tương phản với màu nền
        let hex = colorHex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        if (hex.length === 6) {
            let r = parseInt(hex.substr(0,2), 16);
            let g = parseInt(hex.substr(2,2), 16);
            let b = parseInt(hex.substr(4,2), 16);
            let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            
            if (yiq < 128) {
                // Nền tối -> Chữ đổi màu Trắng
                document.documentElement.style.setProperty('--text-main', '#ffffff');
                document.documentElement.style.setProperty('--text-muted', '#e2e8f0');
            } else {
                // Nền sáng -> Chữ giữ màu Đen
                document.documentElement.style.setProperty('--text-main', '#2c3e50');
                document.documentElement.style.setProperty('--text-muted', '#596275');
            }
        }
    }
    // Update màu chữ của cục +/- 0.00s ở giữa
    updateDTOffset(); 
}

// ===== Khôi phục cấu hình đã lưu =====
(function loadSavedState() {
    try {
        var testKey = '__test_ls__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);

        // Xóa sạch lỗi cũ (Lỗi dính cứng màu nền)
        localStorage.removeItem('bgColor');

        var savedOffset = localStorage.getItem('timeOffset');
        if (savedOffset !== null && savedOffset !== undefined) {
            timeOffset = parseFloat(savedOffset);
            if (isNaN(timeOffset)) timeOffset = 0;
        }

        var savedLink1 = localStorage.getItem('link1');
        if (savedLink1 && savedLink1 !== 'null' && savedLink1 !== 'undefined') {
            link1 = savedLink1;
        }

        // Khôi phục mốc thời gian và màu sắc nháy
        var savedConfig = localStorage.getItem('colorConfig');
        if (savedConfig) {
            colorConfig = JSON.parse(savedConfig);
            
            // Đẩy ngược lại vào Input của Form
            const startInput = document.getElementById('start_seconds');
            const endInput = document.getElementById('end_seconds');
            const colorInput = document.getElementById('hex_background_color');
            if (startInput) startInput.value = colorConfig.start;
            if (endInput) endInput.value = colorConfig.end;
            if (colorInput) colorInput.value = colorConfig.color;
        }
        
        // Mới tải trang thì auto là nền xám mặc định chờ tới giờ mới nháy
        applyBackgroundColor('default');

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

function formatEndTimeHHMMSS(timestampSeconds) {
    if (!timestampSeconds) return '--:--:--';
    const date = new Date(timestampSeconds * 1000);
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return h + ':' + m + ':' + s;
}

if (endTimeDisplayEl) {
    endTimeDisplayEl.textContent = formatEndTimeHHMMSS(endTime);
}

// ===== Hàm cập nhật hiển thị d-t (tổng offset) =====
function updateDTOffset() {
    if (!dTEl) return;
    const absVal = Math.abs(timeOffset);
    let sign = '';
    let color = ''; 

    if (timeOffset > 0) {
        sign = '+';
        color = '#28a745'; // Xanh lá
    } else if (timeOffset < 0) {
        sign = '-';
        color = '#d9534f'; // Đỏ
    } else {
        sign = '+'; 
        // Lấy màu tự động của hệ thống
        color = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#2c3e50';
    }

    dTEl.innerHTML = '<b style="color:' + color + '">' + sign + absVal.toFixed(2) + 's</b>';
}

function formatTimeMMSSF(totalSeconds) {
    const absSec = Math.abs(totalSeconds);
    const seconds = Math.floor(absSec);
    const milliseconds = Math.floor((absSec - Math.floor(absSec)) * 1000);
    const f = String(Math.floor(milliseconds / 100));
    return String(seconds) + '.' + f; 
}

function getCurrentTimeMs() {
    return Date.now();
}

// ===== TRỤC CHÍNH: CẬP NHẬT ĐỒNG HỒ VÀ KIỂM TRA MÀU =====
function updateClock() {
    if (!endTime) {
        if (countdownEl) countdownEl.textContent = '00.0';
        return;
    }

    const now = getCurrentTimeMs();
    const endTimeMs = endTime * 1000;
    const adjustedEndMs = endTimeMs + timeOffset * 1000;
    const diffMs = adjustedEndMs - now;

    // HẾT GIỜ (Về 0s)
    if (diffMs <= 0) {
        if (countdownEl) countdownEl.textContent = '00.0';
        
        // Hết giờ thì buộc web nhả màu, trả về lại mặc định
        if (currentBgState !== 'default') {
            currentBgState = 'default';
            applyBackgroundColor('default');
        }
        return;
    }

    const diffSeconds = diffMs / 1000;
    if (countdownEl) countdownEl.textContent = formatTimeMMSSF(diffSeconds);

    // KIỂM TRA ĐIỀU KIỆN NHÁY MÀU
    if (colorConfig.active) {
        // Đồng hồ đếm lùi, chỉ nháy màu khi thời gian lọt khe (Giữa Bắt Đầu và Kết Thúc)
        if (diffSeconds <= colorConfig.start && diffSeconds >= colorConfig.end) {
            if (currentBgState !== 'flash') {
                currentBgState = 'flash';
                applyBackgroundColor('flash', colorConfig.color);
            }
        } else {
            // Nằm ngoài khe thời gian -> Tắt màu nháy, trả về mặc định
            if (currentBgState !== 'default') {
                currentBgState = 'default';
                applyBackgroundColor('default');
            }
        }
    }
}

function adjustTime(seconds) {
    timeOffset += seconds;
    timeOffset = Math.round(timeOffset * 100) / 100;
    try {
        localStorage.setItem('timeOffset', String(timeOffset));
    } catch (e) {}
    updateDTOffset();
    updateClock();
}

document.getElementById('btn-decrease-0.05').addEventListener('click', function () { adjustTime(-0.05); });
document.getElementById('btn-decrease-0.01').addEventListener('click', function () { adjustTime(-0.01); });
document.getElementById('btn-increase-0.01').addEventListener('click', function () { adjustTime(0.01); });
document.getElementById('btn-increase-0.05').addEventListener('click', function () { adjustTime(0.05); });

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

function handleConfirm(ok) {
    var modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = 'none';
}

var confirmCancelBtn = document.getElementById('confirmCancelBtn');
var confirmOkBtn = document.getElementById('confirmOkBtn');
if (confirmCancelBtn) { confirmCancelBtn.addEventListener('click', function () { handleConfirm(false); }); }
if (confirmOkBtn) { confirmOkBtn.addEventListener('click', function () { handleConfirm(true); }); }

// ===== Bật modal cấu hình nháy màu =====
document.getElementById('btn-open').addEventListener('click', function () {
    var modal = document.getElementById('modal');
    if (modal) modal.style.display = 'flex';
});

// ===== Tắt modal =====
document.getElementById('btn-cancel').addEventListener('click', function () {
    var modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
});

// ===== Nút LƯU CẤU HÌNH NHÁY MÀU =====
document.getElementById('btn-submit').addEventListener('click', function () {
    const startVal = parseFloat(document.getElementById('start_seconds').value);
    const endVal = parseFloat(document.getElementById('end_seconds').value);
    
    // Nạp dữ liệu
    colorConfig.start = isNaN(startVal) ? 0 : startVal;
    colorConfig.end = isNaN(endVal) ? 0 : endVal;
    colorConfig.color = document.getElementById('hex_background_color').value;
    colorConfig.active = true;
    
    // Lưu vào Cache
    try {
        localStorage.setItem('colorConfig', JSON.stringify(colorConfig));
    } catch (e) {}

    // Bắt buộc đẩy web về nền mặc định (Xám), nằm yên đó CHỜ ĐẾN ĐÚNG GIỜ MỚI NHÁY MÀU
    currentBgState = 'default';
    applyBackgroundColor('default');
    
    var modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('modal').addEventListener('click', function (e) {
    if (e.target === this) {
        this.style.display = 'none';
    }
});

updateClock();
updateDTOffset();

setInterval(updateClock, 10);
