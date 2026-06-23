import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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

const urlParams = new URLSearchParams(window.location.search);

let paramM = urlParams.get('m') || 'user';
const paramR = urlParams.get('r') || '';
const tiktokLink = urlParams.get('link') || '';

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

let timeOffset = 0;
let link1 = null;

// ============================================================== //
// HỆ THỐNG PHÒNG XEM CHUNG REAL-TIME (FIREBASE)                  //
// ============================================================== //
const myNameInput = document.getElementById('my-name-input');
const viewersList = document.getElementById('viewers-list');

let mySessionId = localStorage.getItem('mySessionId');
if (!mySessionId) {
    mySessionId = 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    localStorage.setItem('mySessionId', mySessionId);
}

let currentRoomIdStr = '';
let myViewerRef = null;
let roomViewersRef = null;
let unsubscribeViewers = null;

function setupRoomViewers(newEndTime) {
    if (myViewerRef) { remove(myViewerRef); myViewerRef = null; }
    if (unsubscribeViewers) { unsubscribeViewers(); unsubscribeViewers = null; }

    currentRoomIdStr = newEndTime ? `room_${newEndTime}` : 'room_default';
    myViewerRef = ref(db, `rooms/${currentRoomIdStr}/viewers/${mySessionId}`);
    onDisconnect(myViewerRef).remove();

    const savedName = myNameInput && myNameInput.value.trim() !== '' ? myNameInput.value : localStorage.getItem('myName');
    if (savedName) pushNameToFirebase(savedName);

    roomViewersRef = ref(db, `rooms/${currentRoomIdStr}/viewers`);
    unsubscribeViewers = onValue(roomViewersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const names = Object.values(data).filter(n => n.trim() !== '');
            const uniqueNames = [...new Set(names)];
            if (uniqueNames.length > 0) viewersList.innerHTML = `<b>${uniqueNames.join(', ')}</b> đang cày chung`;
            else viewersList.innerHTML = `Chưa có ai điểm danh`;
        } else {
            viewersList.innerHTML = `Chưa có ai điểm danh`;
        }
    });
}

function pushNameToFirebase(name) {
    if (myViewerRef) {
        if (name && name.trim() !== '') {
            set(myViewerRef, name.trim().toUpperCase());
        } else {
            remove(myViewerRef); 
        }
    }
}

if (myNameInput) {
    myNameInput.addEventListener('input', function() {
        const val = this.value;
        try { localStorage.setItem('myName', val); } catch(e){}
        pushNameToFirebase(val);
    });
}

// Khởi chạy Firebase Room lần đầu
setupRoomViewers(endTime);

// ============================================================== //
// HỆ THỐNG WEBSOCKET (BẮT RƯƠNG CHUỖI REALTIME)                  //
// ============================================================== //
let nextBoxesQueue = [];
let liveRoomId = '';

if (tiktokLink) {
    const match = tiktokLink.match(/live\/(\d+)/);
    if (match) liveRoomId = match[1];
}

const customWsUrl = localStorage.getItem('ws_url');
let ws = null;

function connectWebSocket() {
    if (!customWsUrl) return; 
    
    ws = new WebSocket(customWsUrl);
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (liveRoomId && data.room_id === liveRoomId) {
                const nowSec = Math.floor(Date.now() / 1000);
                // CHỈ LẤY RƯƠNG CÁCH >= 20s VÀ CHƯA HẾT HẠN
                if (data.end_time >= (endTime + 20) && data.end_time > nowSec) {
                    const exists = nextBoxesQueue.some(b => b.end_time === data.end_time);
                    if (!exists) {
                        nextBoxesQueue.push(data);
                        nextBoxesQueue.sort((a, b) => a.end_time - b.end_time);
                        updateNextBoxUI();
                    }
                }
            }
        } catch(e) {}
    };
    
    ws.onclose = () => {
        setTimeout(connectWebSocket, 3000); // Mất kết nối thì tự thử lại
    };
}

if (liveRoomId) {
    connectWebSocket();
}

function updateNextBoxUI() {
    const nextBoxWrapper = document.getElementById('nextBoxWrapper');
    const nextBoxCount = document.getElementById('nextBoxCount');
    if (!nextBoxWrapper || !nextBoxCount) return;
    
    if (nextBoxesQueue.length > 0) {
        const nowSec = Math.floor(Date.now() / 1000);
        nextBoxesQueue = nextBoxesQueue.filter(b => b.end_time > nowSec); // Lọc rác
        
        if (nextBoxesQueue.length > 0) {
            nextBoxCount.textContent = nextBoxesQueue.length;
            nextBoxWrapper.style.display = 'block';
        } else {
            nextBoxWrapper.style.display = 'none';
        }
    } else {
        nextBoxWrapper.style.display = 'none';
    }
}

const nextBoxBtnEl = document.getElementById('nextBoxBtn');
if (nextBoxBtnEl) {
    nextBoxBtnEl.addEventListener('click', () => {
        if (nextBoxesQueue.length === 0) return;
        
        const nextBox = nextBoxesQueue.shift();
        
        endTime = nextBox.end_time;
        paramM = nextBox.m; 
        
        const parts = nextBox.r_params.split('|');
        if (parts.length >= 1 && parts[0]) coins = parseInt(parts[0]) || 0;
        if (parts.length >= 2 && parts[1]) canOpen = parseInt(parts[1]) || 0;
        if (parts.length >= 3) hotBoxStr = parts[2] || '🏅🇩🇪';
        if (parts.length >= 4) latestViewersStr = parts[3] || '';
        
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('m', nextBox.m);
        newUrl.searchParams.set('r', nextBox.r_params);
        window.history.replaceState({}, '', newUrl);

        if (usernameDisplayEl) usernameDisplayEl.textContent = nextBox.m;
        if (viewCountEl) viewCountEl.textContent = coins;
        if (peopleCountEl) peopleCountEl.textContent = canOpen;
        if (hotBoxFlagEl) hotBoxFlagEl.textContent = hotBoxStr;
        if (viewersDisplayEl) viewersDisplayEl.textContent = latestViewersStr;
        if (endTimeDisplayEl) endTimeDisplayEl.textContent = formatEndTimeHHMMSS(endTime);
        
        if (countdownEl) {
            countdownEl.style.fontSize = ''; 
            countdownEl.style.color = '';
        }
        document.body.style.backgroundColor = ''; 
        currentBgState = 'default';
        
        isDestroyed = false;
        zeroHitTime = 0;
        
        setupRoomViewers(endTime); 
        updateNextBoxUI();
        updateClock();
    });
}

// ============================================================== //
// UI & LOGIC KHÁC                                                //
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
        await fetch('https://www.tiktok.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
        const pingMs = Date.now() - start; 
        
        networkTimeOffset = Math.round(pingMs / 2);
        
        if (syncStatus) {
            syncStatus.textContent = 'ON';
            syncStatus.style.color = '#22c55e'; 
        }

        if (pingDisplay) {
            let pingColor = '#22c55e'; 
            if (pingMs >= 150 && pingMs < 300) pingColor = '#f59e0b';
            if (pingMs >= 300) pingColor = '#ef4444'; 
            pingDisplay.innerHTML = `Ping mạng: <span style="color: ${pingColor};">${pingMs}ms</span>`;
        }
    } catch (error) {
        if (syncStatus) {
            syncStatus.textContent = 'LỖI PING';
            syncStatus.style.color = '#ef4444'; 
        }
        if (pingDisplay) {
            pingDisplay.innerHTML = `Ping mạng: <span style="color: #ef4444;">LỖI</span>`;
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
        if (pingDisplay) {
            pingDisplay.innerHTML = `Ping mạng: --`;
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

        var savedWsUrl = localStorage.getItem('ws_url');
        if (savedWsUrl) {
            const wsInput = document.getElementById('ws_url_input');
            if (wsInput) wsInput.value = savedWsUrl;
        }

        var savedSync = localStorage.getItem('isSyncOn');
        if (savedSync === 'true') applySyncState(true); 
        else applySyncState(false);

        let savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') applyTheme(true);
        else applyTheme(false);

        let savedName = localStorage.getItem('myName');
        if (savedName && myNameInput) {
            myNameInput.value = savedName;
            pushNameToFirebase(savedName);
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

// ============================================================== //
// THUẬT TOÁN HỦY DIỆT VÀ CHUYỂN RƯƠNG CHUỖI                      //
// ============================================================== //
let zeroHitTime = 0;
let isDestroyed = false;

function destroyApp() {
    if (isDestroyed) return;
    isDestroyed = true;
    
    if (myViewerRef) remove(myViewerRef);

    clearInterval(mainClockInterval);
    if (syncInterval) clearInterval(syncInterval);

    document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; width: 100vw; text-align:center; padding: 20px; background: var(--bg-page);">
            <h2 style="color: var(--text-main); margin-bottom: 15px;">Đã xong nhiệm vụ! ✅</h2>
            <p style="color: var(--text-muted); font-size: 1.05rem; line-height: 1.5;">Hệ thống đã dọn dẹp RAM.<br>Bạn có thể tắt Tab này nhé!</p>
        </div>
    `;
}

function checkAndDestroy() {
    if (nextBoxesQueue.length > 0) {
        if (countdownEl) {
            countdownEl.innerHTML = '<span style="font-size: clamp(2rem, 6vw, 2.5rem); color: #3b82f6;">BẤM NEXT ➔</span>';
        }
        document.body.style.backgroundColor = '#dbeafe'; 
        return; 
    }
    destroyApp();
}

document.addEventListener("visibilitychange", function() {
    if (document.hidden) {
        if (myViewerRef) remove(myViewerRef);
        if (endTime && getCurrentTimeMs() >= (endTime * 1000 + timeOffset * 1000)) {
            checkAndDestroy();
        }
    } else {
        if (myNameInput && myNameInput.value.trim() !== '') {
            pushNameToFirebase(myNameInput.value);
        }
        if (zeroHitTime > 0 && Date.now() - zeroHitTime >= 3000) {
            checkAndDestroy();
        }
    }
});

function updateClock() {
    updateNextBoxUI(); // Liên tục dọn dẹp mảng rương chờ

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
            checkAndDestroy();
        }
        return;
    }

    const diffSeconds = diffMs / 1000;
    const displayedText = formatTimeMMSSF(diffSeconds);
    
    if (countdownEl && zeroHitTime === 0) {
        countdownEl.textContent = displayedText;
    }

    if (colorConfig.active && zeroHitTime === 0) {
        const currentDisplayNum = parseFloat(displayedText);
        if (currentDisplayNum <= colorConfig.start && currentDisplayNum >= colorConfig.end) {
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

    try { localStorage.setItem('colorConfig', JSON.stringify(colorConfig)); } catch (e) {}
    
    // LƯU CLOUDFLARE TUNNEL URL
    const wsUrlVal = document.getElementById('ws_url_input').value.trim();
    if (wsUrlVal) {
        localStorage.setItem('ws_url', wsUrlVal);
    } else {
        localStorage.removeItem('ws_url');
    }

    updateConfigDisplayUI();

    currentBgState = 'default';
    applyBackgroundColor('default');

    var modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'none';
        if (wsUrlVal && (!ws || ws.url !== wsUrlVal)) location.reload(); // Reload để áp dụng Tunnel mới
    }
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










// ============================================================== //
// SCRIPT TEST RƯƠNG CHUỖI (XÓA ĐI SAU KHI TEST XONG NHÉ)
// ============================================================== //
setTimeout(() => {
    if (liveRoomId && ws) {
        // 1. Tạo rương giả số 2 (Cách rương hiện tại 30 giây)
        const fakeBox2 = {
            room_id: liveRoomId, 
            end_time: endTime + 30, 
            m: paramM,
            r_params: "999|25|🎁 TEST 2|999|" + (endTime + 30),
            tiktok_link: tiktokLink
        };
        ws.onmessage({ data: JSON.stringify(fakeBox2) });

        // 2. Tạo thêm rương giả số 3 luôn cho máu (Cách rương hiện tại 60 giây)
        setTimeout(() => {
            const fakeBox3 = {
                room_id: liveRoomId, 
                end_time: endTime + 60, 
                m: paramM,
                r_params: "888|25|🎁 TEST 3|888|" + (endTime + 60),
                tiktok_link: tiktokLink
            };
            ws.onmessage({ data: JSON.stringify(fakeBox3) });
        }, 500);
    }
}, 4000); // Sẽ tự động thả 2 rương giả sau 4 giây kể từ lúc mở Web UI
