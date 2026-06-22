// BẮT BUỘC IMPORT FIREBASE TỪ CDN BÊN NGOÀI
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ===== KẾT NỐI MÁY CHỦ FIREBASE CỦA BẠN =====
const firebaseConfig = {
    apiKey: "AIzaSyAOzLEX4hjRbp3pEbEm5dL2iqHUWZ0EZCM",
    authDomain: "canh-ruong-tiktok.firebaseapp.com",
    databaseURL: "https://canh-ruong-tiktok-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "canh-ruong-tiktok",
    storageBucket: "canh-ruong-tiktok.firebasestorage.app",
    messagingSenderId: "180203178276",
    appId: "1:180203178276:web:49509b237ec8a8fb578bb1"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

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
// HỆ THỐNG PHÒNG XEM CHUNG REAL-TIME (FIREBASE)                  //
// ============================================================== //
const myNameInput = document.getElementById('my-name-input');
const viewersList = document.getElementById('viewers-list');

// 1. Tạo ID phân biệt thiết bị để không bị trùng lặp
let mySessionId = localStorage.getItem('mySessionId');
if (!mySessionId) {
    mySessionId = 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    localStorage.setItem('mySessionId', mySessionId);
}

// 2. Chia phòng dựa vào thời gian EndTime của Rương
const roomId = endTime ? `room_${endTime}` : 'room_default';
const myViewerRef = ref(db, `rooms/${roomId}/viewers/${mySessionId}`);

// 3. TUYỆT CHIÊU: Tự động xóa tên khi người dùng tắt trình duyệt / mất mạng
onDisconnect(myViewerRef).remove();

// 4. Hàm đẩy tên lên Máy chủ
function pushNameToFirebase(name) {
    if (name && name.trim() !== '') {
        set(myViewerRef, name.trim().toUpperCase());
    } else {
        remove(myViewerRef); // Xóa nếu để trống tên
    }
}

// 5. Lắng nghe tên khi người dùng gõ phím
if (myNameInput) {
    myNameInput.addEventListener('input', function() {
        const val = this.value;
        try { localStorage.setItem('myName', val); } catch(e){}
        pushNameToFirebase(val);
    });
}

// 6. Lắng nghe Máy chủ phát sóng về: Có ai đang xem?
const roomViewersRef = ref(db, `rooms/${roomId}/viewers`);
onValue(roomViewersRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        // Lấy danh sách tên, lọc bỏ khoảng trắng và lọc trùng lặp
        const names = Object.values(data).filter(n => n.trim() !== '');
        const uniqueNames = [...new Set(names)];
        
        if (uniqueNames.length > 0) {
            viewersList.innerHTML = `<b>${uniqueNames.join(', ')}</b> đang cày chung`;
        } else {
            viewersList.innerHTML = `Chưa có ai điểm danh`;
        }
    } else {
        viewersList.innerHTML = `Chưa có ai điểm danh`;
    }
});


// ============================================================== //
// LOGIC CHUYỂN ĐỔI CHẾ ĐỘ SÁNG / TỐI (DARK MODE)                 //
// ============================================================== //
let isDarkMode = false;
const btnTheme = document.getElementById('btn-theme');
const themeIcon = document.getElementById('theme-icon');
const themeText = document.getElementById('theme-text');

function applyTheme(isDark) {
    isDarkMode = isDark;
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        if (themeIcon) themeIcon.textContent = '🌞';
        if (themeText) themeText.textContent = 'Light';
    } else {
        document.body.classList.remove('dark-mode');
        if (themeIcon) themeIcon.textContent = '🌙';
        if (themeText) themeText.textContent = 'Dark';
    }
    try { localStorage.setItem('theme', isDarkMode ? 'dark' : 'light'); } catch (e) {}
}

if (btnTheme) {
    btnTheme.addEventListener('click', () => {
        applyTheme(!isDarkMode);
    });
}

// ============================================================== //
// CƠ CHẾ ĐỒNG BỘ THỜI GIAN (SYNC TIME) ĐUA TỐC ĐỘ                //
// ============================================================== //
let isSyncOn = false;
let networkTimeOffset = 0; 
let syncInterval = null;

const btnSync = document.getElementById('btn-sync');
const syncStatus = document.getElementById('sync-status');
const pingDisplay = document.getElementById('pingDisplay'); 

async function pingTimeServer() {
    if (!isSyncOn) return;
    try {
        const start = Date.now();
        
        const fetchBinance = fetch('https://api.binance.com/api/v3/time', { cache: 'no-store' })
            .then(r => r.json()).then(d => d.serverTime);
            
        const fetchKucoin = fetch('https://api.kucoin.com/api/v1/timestamp', { cache: 'no-store' })
            .then(r => r.json()).then(d => d.data);
            
        const fetchBybit = fetch('https://api.bybit.com/v5/market/time', { cache: 'no-store' })
            .then(r => r.json()).then(d => Number(d.time));

        const serverTime = await Promise.any([fetchBinance, fetchKucoin, fetchBybit]);
        
        const end = Date.now();
        const latency = (end - start) / 2;
        
        networkTimeOffset = (serverTime + latency) - Date.now();
        
        if (syncStatus) {
            syncStatus.textContent = 'ON';
            syncStatus.style.color = '#22c55e'; 
        }

        // TÍNH TOÁN HIỂN THỊ PING ĐỘ LỆCH VÀ MÀU SẮC
        if (pingDisplay) {
            let sign = networkTimeOffset >= 0 ? '+' : '';
            let offsetInSeconds = (networkTimeOffset / 1000).toFixed(3);
            
            // LOGIC MÀU MỚI: Dương (+) -> Xanh lá | Âm (-) -> Đỏ
            let pingColor = networkTimeOffset >= 0 ? '#22c55e' : '#ef4444'; 
            
            pingDisplay.innerHTML = `Ping ms: <span style="color: ${pingColor};">${sign}${offsetInSeconds}s</span>`;
        }

    } catch (error) {
        if (syncStatus) {
            syncStatus.textContent = 'LỖI PING';
            syncStatus.style.color = '#ef4444'; 
        }
        if (pingDisplay) {
            pingDisplay.innerHTML = `Ping ms: <span style="color: #ef4444;">LỖI</span>`;
        }
    }
}

function applySyncState(state) {
    if (state) {
        isSyncOn = true;
        if (syncStatus) {
            syncStatus.textContent = 'PING...';
            syncStatus.style.color = '#f59e0b'; 
        }
        pingTimeServer(); 
        clearInterval(syncInterval);
        syncInterval = setInterval(pingTimeServer, 5000);
        try { localStorage.setItem('isSyncOn', 'true'); } catch (e) {}
    } else {
        isSyncOn = false;
        networkTimeOffset = 0;
        clearInterval(syncInterval);
        if (syncStatus) {
            syncStatus.textContent = 'OFF';
            syncStatus.style.color = '#ef4444'; 
        }
        
        // TRẢ VỀ MẶC ĐỊNH KHI TẮT SYNC
        if (pingDisplay) {
            pingDisplay.innerHTML = `Ping ms: --`;
        }

        try { localStorage.setItem('isSyncOn', 'false'); } catch (e) {}
    }
}

if (btnSync) {
    btnSync.addEventListener('click', function() {
        applySyncState(!isSyncOn);
    });
}

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
        document.body.style.backgroundColor = ''; 
        document.querySelector('.app-card').style.backgroundColor = ''; 
        document.documentElement.style.removeProperty('--text-main');
        document.documentElement.style.removeProperty('--text-muted');
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

// ===== KHÔI PHỤC TOÀN BỘ CẤU HÌNH ĐÃ LƯU KHI MỞ LINK MỚI =====
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

        var savedSync = localStorage.getItem('isSyncOn');
        if (savedSync === 'true') applySyncState(true); 
        else applySyncState(false);

        let savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') applyTheme(true);
        else applyTheme(false);

        // Khôi phục Tên và Đẩy lên máy chủ ngay lập tức
        let savedName = localStorage.getItem('myName');
        if (savedName && myNameInput) {
            myNameInput.value = savedName;
            pushNameToFirebase(savedName);
        }

        updateConfigDisplayUI(); 
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

// ============================================================== //
// THUẬT TOÁN HỦY DIỆT ĐA TẦNG (CHỐNG NGỦ ĐÔNG CỦA IOS)           //
// ============================================================== //
let zeroHitTime = 0;
let isDestroyed = false;

function destroyApp() {
    if (isDestroyed) return;
    isDestroyed = true;
    
    // Xóa kết nối Firebase khi hủy App
    remove(myViewerRef);

    clearInterval(mainClockInterval);
    if (syncInterval) clearInterval(syncInterval);

    document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; width: 100vw; text-align:center; padding: 20px; background: var(--bg-page);">
            <h2 style="color: var(--text-main); margin-bottom: 15px;">Đã xong nhiệm vụ! ✅</h2>
            <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.5;">Đang dọn dẹp RAM...</p>
        </div>
    `;

    setTimeout(() => {
        window.location.replace("about:blank");
    }, 1000);
}

document.addEventListener("visibilitychange", function() {
    if (document.hidden) {
        if (endTime && getCurrentTimeMs() >= (endTime * 1000 + timeOffset * 1000)) {
            destroyApp();
        }
    } else {
        if (zeroHitTime > 0 && Date.now() - zeroHitTime >= 3000) {
            destroyApp();
        }
    }
});

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

        if (zeroHitTime === 0) {
            zeroHitTime = Date.now();
        }

        if (Date.now() - zeroHitTime >= 3000) {
            destroyApp();
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

const mainClockInterval = setInterval(updateClock, 10);
