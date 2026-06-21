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

// ============================================================== //
// CƠ CHẾ ĐỒNG BỘ THỜI GIAN (SYNC TIME) BẰNG SERVER BINANCE CỰC MẠNH //
// ============================================================== //
let isSyncOn = false;
let networkTimeOffset = 0; 
let syncInterval = null;

const btnSync = document.getElementById('btn-sync');
const syncStatus = document.getElementById('sync-status');

// Hàm PING server lấy giờ chuẩn
async function pingTimeServer() {
    if (!isSyncOn) return;
    try {
        const start = Date.now();
        
        // Gửi lệnh hỏi giờ đến 3 sàn giao dịch có máy chủ nhanh nhất thế giới cùng 1 lúc
        const fetchBinance = fetch('https://api.binance.com/api/v3/time', { cache: 'no-store' })
            .then(r => r.json()).then(d => d.serverTime);
            
        const fetchKucoin = fetch('https://api.kucoin.com/api/v1/timestamp', { cache: 'no-store' })
            .then(r => r.json()).then(d => d.data);
            
        const fetchBybit = fetch('https://api.bybit.com/v5/market/time', { cache: 'no-store' })
            .then(r => r.json()).then(d => Number(d.time));

        // Promise.any: Thằng nào phản hồi nhanh nhất (Ping thấp nhất) sẽ được lấy kết quả, bỏ qua các thằng chậm hơn
        const serverTime = await Promise.any([fetchBinance, fetchKucoin, fetchBybit]);
        
        const end = Date.now();
        const latency = (end - start) / 2; // Tính thời gian truyền đi 1 chiều
        
        // Tinh chỉnh độ lệch: (Giờ server thực tế + độ trễ mạng) - Giờ máy hiện tại
        networkTimeOffset = (serverTime + latency) - Date.now();
        
        if (syncStatus) {
            syncStatus.textContent = 'ON';
            syncStatus.style.color = '#22c55e'; // Xanh lá
        }
    } catch (error) {
        if (syncStatus) {
            syncStatus.textContent = 'LỖI PING';
            syncStatus.style.color = '#ef4444'; // Báo lỗi nếu rớt mạng hoàn toàn
        }
    }
}

// Lắng nghe thao tác Bật / Tắt Sync
if (btnSync) {
    btnSync.addEventListener('click', function() {
        if (isSyncOn) {
            // TẮT SYNC
            isSyncOn = false;
            networkTimeOffset = 0;
            clearInterval(syncInterval);
            
            syncStatus.textContent = 'OFF';
            syncStatus.style.color = '#ef4444'; 
        } else {
            // BẬT SYNC
            isSyncOn = true;
            syncStatus.textContent = 'PING...';
            syncStatus.style.color = '#f59e0b'; // Màu vàng cam đang load
            
            pingTimeServer(); // Ping phát đầu tiên ngay lập tức
            
            // Cài đặt ping liên tục mỗi 5 giây để luôn giữ sai số nhỏ nhất ở mức ms
            syncInterval = setInterval(pingTimeServer, 5000);
        }
    });
}

// Hàm lấy thời gian: Tự động cộng/trừ sai số nếu bật Sync
function getCurrentTimeMs() {
    return Date.now() + (isSyncOn ? networkTimeOffset : 0);
}


// ===== CẤU HÌNH NHÁY MÀU NỀN =====
let colorConfig = {
    active: false,
    start: 0.6,
    end: 0.0,
    color: '#ff0000'
};
let currentBgState = 'default';

const activeConfigDisplay = document.getElementById('activeConfigDisplay');
const configColorDot = document.getElementById('configColorDot');
const configText = document.getElementById('configText');

function updateConfigDisplayUI() {
    if (!activeConfigDisplay) return;
    if (colorConfig && colorConfig.active) {
        configColorDot.style.backgroundColor = colorConfig.color;
        configText.textContent = `Từ ${colorConfig.start}s đến ${colorConfig.end}s`;
        activeConfigDisplay.style.display = 'flex'; 
    } else {
        activeConfigDisplay.style.display = 'none'; 
    }
}

function applyBackgroundColor(state, colorHex = '') {
    if (state === 'default') {
        document.body.style.backgroundColor = 'var(--bg-page)'; 
        document.documentElement.style.setProperty('--text-main', '#1e293b');
        document.documentElement.style.setProperty('--text-muted', '#64748b');
        document.querySelector('.app-card').style.backgroundColor = 'var(--card-bg)'; 
    } else if (state === 'flash') {
        document.body.style.backgroundColor = colorHex;
        document.querySelector('.app-card').style.backgroundColor = colorHex;

        let hex = colorHex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        if (hex.length === 6) {
            let r = parseInt(hex.substr(0,2), 16);
            let g = parseInt(hex.substr(2,2), 16);
            let b = parseInt(hex.substr(4,2), 16);
            let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

            if (yiq < 128) {
                document.documentElement.style.setProperty('--text-main', '#ffffff');
                document.documentElement.style.setProperty('--text-muted', '#e2e8f0');
            } else {
                document.documentElement.style.setProperty('--text-main', '#1e293b');
                document.documentElement.style.setProperty('--text-muted', '#64748b');
            }
        }
    }
    updateDTOffset();
}

(function loadSavedState() {
    try {
        var testKey = '__test_ls__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
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

        var savedConfig = localStorage.getItem('colorConfig');
        if (savedConfig) {
            colorConfig = JSON.parse(savedConfig);

            const startInput = document.getElementById('start_seconds');
            const endInput = document.getElementById('end_seconds');
            const colorInput = document.getElementById('hex_background_color');
            if (startInput) startInput.value = colorConfig.start;
            if (endInput) endInput.value = colorConfig.end;
            if (colorInput) colorInput.value = colorConfig.color;
        }

        updateConfigDisplayUI(); 
        applyBackgroundColor('default');

    } catch (e) {}
})();

const countdownEl = document.getElementById('countdown');
const endTimeDisplayEl = document.getElementById('endTimeDisplay');
const viewCountEl = document.getElementById('viewCount');
const peopleCountEl = document.getElementById('peopleCount');
const dTEl = document.getElementById('d-t');
const usernameDisplayEl = document.getElementById('usernameDisplay');
const hotBoxFlagEl = document.getElementById('hotBoxFlag');
const viewersDisplayEl = document.getElementById('viewersDisplay');

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

function updateDTOffset() {
    if (!dTEl) return;
    const absVal = Math.abs(timeOffset);
    let sign = '';
    let color = '';

    if (timeOffset > 0) {
        sign = '+';
        color = '#22c55e'; 
    } else if (timeOffset < 0) {
        sign = '-';
        color = '#ef4444'; 
    } else {
        sign = '+';
        color = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#1e293b';
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

        if (currentBgState !== 'default') {
            currentBgState = 'default';
            applyBackgroundColor('default');
        }
        return;
    }

    const diffSeconds = diffMs / 1000;
    if (countdownEl) countdownEl.textContent = formatTimeMMSSF(diffSeconds);

    if (colorConfig.active) {
        if (diffSeconds <= colorConfig.start && diffSeconds >= colorConfig.end) {
            if (currentBgState !== 'flash') {
                currentBgState = 'flash';
                applyBackgroundColor('flash', colorConfig.color);
            }
        } else {
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

document.getElementById('btn-open').addEventListener('click', function () {
    var modal = document.getElementById('modal');
    if (modal) modal.style.display = 'flex';
});

document.getElementById('btn-cancel').addEventListener('click', function () {
    var modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('btn-submit').addEventListener('click', function () {
    const startVal = parseFloat(document.getElementById('start_seconds').value);
    const endVal = parseFloat(document.getElementById('end_seconds').value);

    colorConfig.start = isNaN(startVal) ? 0 : startVal;
    colorConfig.end = isNaN(endVal) ? 0 : endVal;
    colorConfig.color = document.getElementById('hex_background_color').value;
    colorConfig.active = true;

    try {
        localStorage.setItem('colorConfig', JSON.stringify(colorConfig));
    } catch (e) {}

    updateConfigDisplayUI();

    currentBgState = 'default';
    applyBackgroundColor('default');

    var modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('configDelBtn').addEventListener('click', function() {
    colorConfig.active = false;
    try {
        localStorage.setItem('colorConfig', JSON.stringify(colorConfig));
    } catch (e) {}
    
    updateConfigDisplayUI(); 
    
    currentBgState = 'default';
    applyBackgroundColor('default');
});

document.getElementById('modal').addEventListener('click', function (e) {
    if (e.target === this) {
        this.style.display = 'none';
    }
});

updateClock();
updateDTOffset();

setInterval(updateClock, 10);
