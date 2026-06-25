import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, update, onValue, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ============================================================== //
// 0. BỌC THÉP HỆ THỐNG LƯU TRỮ (CHỐNG CRASH TRÊN TRÌNH DUYỆT ẨN) //
// ============================================================== //
function safeGetItem(key, defaultVal = null) {
    try { return localStorage.getItem(key) || defaultVal; } catch(e) { return defaultVal; }
}
function safeSetItem(key, val) {
    try { localStorage.setItem(key, val); } catch(e) {}
}
function safeRemoveItem(key) {
    try { localStorage.removeItem(key); } catch(e) {}
}

// ============================================================== //
// 1. KHAI BÁO TOÀN BỘ GIAO DIỆN TRƯỚC (CHỐNG LỖI SẬP JAVASCRIPT) //
// ============================================================== //
const lockScreen = document.getElementById('vipLockScreen');
const displayDeviceId = document.getElementById('displayDeviceId');
const btnCopyDeviceId = document.getElementById('btnCopyDeviceId');
const nameInputEl = document.getElementById('my-name-input');
const btnSwitchUI = document.getElementById('btn-switch-ui');
const viewersList = document.getElementById('viewers-list');
const pingDisplay = document.getElementById('pingDisplay');
const syncStatus = document.getElementById('sync-status');
const nextBoxWrapper = document.getElementById('nextBoxWrapper');
const btnPrevBox = document.getElementById('prevBoxBtn');
const btnNextBox = document.getElementById('nextBoxBtn');
const prevBoxCount = document.getElementById('prevBoxCount');
const nextBoxCount = document.getElementById('nextBoxCount');
const usernameDisplayEl = document.getElementById('usernameDisplay');
const viewCountEl = document.getElementById('viewCount');
const peopleCountEl = document.getElementById('peopleCount');
const hotBoxFlagEl = document.getElementById('hotBoxFlag');
const viewersDisplayEl = document.getElementById('viewersDisplay');
const endTimeDisplayEl = document.getElementById('endTimeDisplay');
const countdownEl = document.getElementById('countdown');
const serverTimeDisplayEl = document.getElementById('serverTimeDisplay');
const dTEl = document.getElementById('d-t');
const btnSync = document.getElementById('btn-sync');
const activeConfigDisplay = document.getElementById('activeConfigDisplay');
const configColorDot = document.getElementById('configColorDot');
const configText = document.getElementById('configText');
const dec005 = document.getElementById('btn-decrease-0.05');
const dec001 = document.getElementById('btn-decrease-0.01');
const inc001 = document.getElementById('btn-increase-0.01');
const inc005 = document.getElementById('btn-increase-0.05');
const claimBtn = document.getElementById('claimBtn');
const claimChangeBtn = document.getElementById('claimChangeBtn');
const confirmModal = document.getElementById('confirmModal');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const btnOpen = document.getElementById('btn-open');
const btnCancel = document.getElementById('btn-cancel');
const btnSubmit = document.getElementById('btn-submit');
const configDelBtn = document.getElementById('configDelBtn');
const modalEl = document.getElementById('modal');
const startSecondsEl = document.getElementById('start_seconds');
const endSecondsEl = document.getElementById('end_seconds');
const hexBgColorEl = document.getElementById('hex_background_color');
const wsUrlInputEl = document.getElementById('ws_url_input');

// ============================================================== //
// 2. KHỞI TẠO CÁC BIẾN TOÀN CỤC THÔNG SỐ RƯƠNG                   //
// ============================================================== //
const urlParams = new URLSearchParams(window.location.search);
let paramM = urlParams.get('m') || 'user';
const paramR = urlParams.get('r') || '';
const tiktokLink = urlParams.get('link') || '';

let coins = 80; let canOpen = 25; let hotBoxStr = '🏅🇩🇪'; let latestViewersStr = ''; let endTime = 0;

if (paramR) {
    const parts = paramR.split('|');
    if (parts.length >= 1 && parts[0]) coins = parseInt(parts[0]) || 0;
    if (parts.length >= 2 && parts[1]) canOpen = parseInt(parts[1]) || 0;
    if (parts.length >= 3) hotBoxStr = parts[2] || '🏅🇩🇪';
    if (parts.length >= 4) latestViewersStr = parts[3] || '';
    if (parts.length >= 5) endTime = parseInt(parts[4]) || 0;
}

let timeOffset = 0; let link1 = null;
let timeBase = Date.now() - performance.now();
function getAccurateTime() { return performance.now() + timeBase; }
const isT3 = window.location.pathname.includes('t3.html');

let openedToday = parseInt(safeGetItem('opened_today', 0)) || 0;

function checkAndReset3AM() {
    const now = new Date();
    const vnTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const resetLimit = new Date(vnTime);
    resetLimit.setHours(3, 0, 0, 0);
    
    if (vnTime.getHours() < 3) {
        resetLimit.setDate(resetLimit.getDate() - 1);
    }
    
    const currentResetMark = resetLimit.getTime();
    const lastResetMark = parseInt(safeGetItem('last_reset_3am', 0)) || 0;
    
    if (lastResetMark !== currentResetMark) {
        safeSetItem('opened_today', 0);
        safeSetItem('last_reset_3am', currentResetMark);
        return 0;
    }
    return parseInt(safeGetItem('opened_today', 0)) || 0;
}
openedToday = checkAndReset3AM();

function recordBoxOpen(currentEndTime) {
    if (!currentEndTime || currentEndTime <= 0) return;
    const lastCounted = safeGetItem('last_counted_endtime');
    
    if (lastCounted !== currentEndTime.toString()) {
        openedToday++;
        safeSetItem('opened_today', openedToday);
        safeSetItem('last_counted_endtime', currentEndTime.toString());
    }
}
recordBoxOpen(endTime);

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
if (endTimeDisplayEl) endTimeDisplayEl.textContent = formatEndTimeHHMMSS(endTime);

// ============================================================== //
// 3. KẾT NỐI FIREBASE                                            //
// ============================================================== //
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

// ============================================================== //
// 4. TẠO ĐỊNH DANH MÁY (DEVICE ID) BẢO MẬT                       //
// ============================================================== //
let deviceId = safeGetItem('vip_device_id');
if (!deviceId) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomStr = (length) => Array.from({length}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    deviceId = `VIP-${randomStr(4)}-${randomStr(4)}`;
    safeSetItem('vip_device_id', deviceId);
}

if (displayDeviceId) displayDeviceId.textContent = deviceId; 
if (btnCopyDeviceId) {
    btnCopyDeviceId.addEventListener('click', () => {
        navigator.clipboard.writeText(deviceId);
        btnCopyDeviceId.textContent = '✅ ĐÃ COPY MÃ';
        setTimeout(() => { btnCopyDeviceId.textContent = '📋 COPY MÃ GỬI ADMIN'; }, 2000);
    });
}

// ============================================================== //
// 5. LẮNG NGHE LỆNH TỪ LÃNH CHÚA (CHỐNG CHỚP & XỬ LÝ QUYỀN)      //
// ============================================================== //
let isFreeMode = false;
let deviceStatus = 'unknown'; 
let adminOffset = 0; 
let isFreeModeLoaded = false;
let isDeviceLoaded = false;
let currentPingMs = 0; // Biến lưu Ping hiện tại

const deviceRef = ref(db, `devices/${deviceId}`);

const lastAccessState = safeGetItem('last_access_state');
if (lastAccessState === 'granted' && lockScreen) {
    lockScreen.style.display = 'none';
} else if (lockScreen) {
    lockScreen.style.display = 'flex';
}

function pushHeartbeat() {
    if (document.hidden) return; 
    
    update(deviceRef, {
        last_active: Date.now(),
        opened_today: openedToday, 
        current_task: {
            rate: paramM || 'Đang chờ...',
            coins: coins || 0,
            can_open: canOpen || 0, 
            end_time: endTime || 0,
            ping: currentPingMs, // Bắn Ping lên Admin
            flag: hotBoxStr // Bắn thẳng Cờ Rương lên Admin
        }
    }).catch(()=>{});
}

function checkAccess() {
    if (!isFreeModeLoaded || !isDeviceLoaded) return;
    
    if (deviceStatus === 'locked') {
        if (lockScreen) lockScreen.style.display = 'flex';
        safeSetItem('last_access_state', 'denied');
        return;
    }
    
    if (isFreeMode || deviceStatus === 'active') {
        if (lockScreen) lockScreen.style.display = 'none';
        safeSetItem('last_access_state', 'granted');
        pushHeartbeat(); 
    } else {
        if (lockScreen) lockScreen.style.display = 'flex';
        safeSetItem('last_access_state', 'denied');
    }
}

onValue(ref(db, 'global_settings/free_mode'), (snapshot) => {
    isFreeMode = !!snapshot.val();
    isFreeModeLoaded = true; 
    checkAccess();
});

onValue(deviceRef, (snapshot) => {
    isDeviceLoaded = true; 
    const data = snapshot.val();

    if (data) {
        deviceStatus = data.status || 'unknown';
        adminOffset = parseFloat(data.admin_offset) || 0;

        if (deviceStatus === 'active' && data.note) {
            if (nameInputEl) {
                if (nameInputEl.value !== data.note) {
                    nameInputEl.value = data.note;
                    safeSetItem('myName', data.note);
                    pushNameToFirebase(data.note);
                }
                nameInputEl.disabled = true;
            }
        } else {
            if (nameInputEl) nameInputEl.disabled = false;
        }
    } else {
        deviceStatus = 'unknown';
        adminOffset = 0;
        if (nameInputEl) nameInputEl.disabled = false;
    }
    
    forceUpdateClock(); 
    checkAccess();
});

setInterval(pushHeartbeat, 30000);
onDisconnect(deviceRef).update({ 
    last_active: Date.now(),
    'current_task/rate': 'Đã thoát Web...',
    'current_task/end_time': 0 
});

document.addEventListener("visibilitychange", function() {
    if (document.hidden) { 
        if (myViewerRef) remove(myViewerRef); 
        update(deviceRef, {
            'current_task/rate': 'Đang ẩn Tab...',
            'current_task/end_time': 0
        }).catch(()=>{});
    } 
    else {
        if (nameInputEl && nameInputEl.value.trim() !== '') { pushNameToFirebase(nameInputEl.value); }
        pushHeartbeat(); 
    }
});


// ============================================================== //
// CÁC HÀM CỐT LÕI (GIỮ NGUYÊN GỐC KHÔNG THAY ĐỔI)
// ============================================================== //
if (btnSwitchUI) {
    btnSwitchUI.addEventListener('click', () => {
        const currentUI = safeGetItem('active_ui', 'T1');
        const newUI = currentUI === 'T1' ? 'T3' : 'T1';
        safeSetItem('active_ui', newUI);
        const targetPage = newUI === 'T3' ? 't3.html' : 'index.html';
        window.location.href = targetPage + window.location.search;
    });
}

let mySessionId = safeGetItem('mySessionId');
if (!mySessionId) {
    mySessionId = 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    safeSetItem('mySessionId', mySessionId);
}

let currentRoomIdStr = ''; let myViewerRef = null; let roomViewersRef = null; let unsubscribeViewers = null;

function setupRoomViewers(newEndTime) {
    if (myViewerRef) { remove(myViewerRef); myViewerRef = null; }
    if (unsubscribeViewers) { unsubscribeViewers(); unsubscribeViewers = null; }

    currentRoomIdStr = newEndTime ? `room_${newEndTime}` : 'room_default';
    myViewerRef = ref(db, `rooms/${currentRoomIdStr}/viewers/${mySessionId}`);
    onDisconnect(myViewerRef).remove();

    const savedName = nameInputEl && nameInputEl.value.trim() !== '' ? nameInputEl.value : safeGetItem('myName');
    if (savedName) pushNameToFirebase(savedName);

    roomViewersRef = ref(db, `rooms/${currentRoomIdStr}/viewers`);
    unsubscribeViewers = onValue(roomViewersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const names = Object.values(data).filter(n => n.trim() !== '');
            const uniqueNames = [...new Set(names)];
            if (uniqueNames.length > 0) {
                if(viewersList) viewersList.innerHTML = `<b>${uniqueNames.join(', ')}</b> đang cày chung`;
            } else { if(viewersList) viewersList.innerHTML = `Chưa có ai điểm danh`; }
        } else { if(viewersList) viewersList.innerHTML = `Chưa có ai điểm danh`; }
    });
}

function pushNameToFirebase(name) {
    if (myViewerRef) {
        if (name && name.trim() !== '') { set(myViewerRef, name.trim().toUpperCase()); } 
        else { remove(myViewerRef); }
    }
}

if (nameInputEl) {
    nameInputEl.addEventListener('input', function() {
        const val = this.value;
        safeSetItem('myName', val);
        pushNameToFirebase(val);
    });
}

setupRoomViewers(endTime);

let allBoxes = []; let liveRoomId = '';
if (tiktokLink) { const match = tiktokLink.match(/live\/(\d+)/); if (match) liveRoomId = match[1]; }
if (endTime && liveRoomId) { allBoxes.push({ room_id: liveRoomId, end_time: endTime, m: paramM, r_params: paramR, tiktok_link: tiktokLink }); }

const paramWs = urlParams.get('ws');
const customWsUrl = paramWs || safeGetItem('ws_url');
let ws = null; let wsPingInterval = null; let isSyncOn = isT3 ? true : false; let networkTimeOffset = 0; 

function startWsPing() {
    if (wsPingInterval) clearInterval(wsPingInterval);
    wsPingInterval = setInterval(() => {
        if (ws && ws.readyState === 1 && (isT3 || isSyncOn)) { ws.send(JSON.stringify({ action: 'ping', client_time: getAccurateTime() })); }
    }, 1500);
}

function connectWebSocket() {
    if (!customWsUrl) return; 
    ws = new WebSocket(customWsUrl);
    ws.onopen = () => {
        startWsPing();
        if (!isT3 && isSyncOn && ws.readyState === 1) { ws.send(JSON.stringify({ action: 'ping', client_time: getAccurateTime() })); }
    };
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.action === 'pong') {
                const now = getAccurateTime();
                const rtt = now - data.client_time;
                const pingMs = rtt / 2;
                currentPingMs = pingMs; // CẬP NHẬT PING
                const pingS = (pingMs / 1000).toFixed(3);
                
                if (data.server_time) { networkTimeOffset = (data.server_time + pingMs) - now; } 
                else { networkTimeOffset = pingMs; }

                const endTimeMs = endTime * 1000;
                const diffMs = (endTimeMs + timeOffset * 1000) - now;

                if (isT3 && pingDisplay && diffMs > 0) {
                    let statusText = '✅ internet tốt';
                    if (pingMs > 150) statusText = '⚠️ mạng khá';
                    if (pingMs > 300) statusText = '❌ mạng kém';
                    pingDisplay.innerHTML = `Ping ${pingS}s (syncing - ${statusText})`;
                }
                else if (!isT3 && isSyncOn && pingDisplay) {
                    let pingColor = '#22c55e'; 
                    if (pingMs >= 150 && pingMs < 300) pingColor = '#f59e0b';
                    if (pingMs >= 300) pingColor = '#ef4444'; 
                    pingDisplay.innerHTML = `Ping ms : <span style="color: ${pingColor};">${pingS}s</span>`;
                    if (syncStatus) { syncStatus.textContent = 'ON'; syncStatus.style.color = '#22c55e'; }
                }
                return; 
            }

            if (liveRoomId && data.room_id === liveRoomId) {
                const nowSec = Math.floor(getAccurateTime() / 1000);
                if (data.end_time + 300 > nowSec) {
                    const exists = allBoxes.some(b => b.end_time === data.end_time);
                    if (!exists) {
                        allBoxes.push(data);
                        allBoxes.sort((a, b) => a.end_time - b.end_time);
                        updateNavigationUI();
                    }
                }
            }
        } catch(e) {}
    };
    
    ws.onclose = () => { 
        clearInterval(wsPingInterval);
        if (isT3 && pingDisplay) { pingDisplay.innerHTML = `Ping lỗi (syncing - ❌ offline)`; } 
        else if (!isT3 && isSyncOn && pingDisplay) {
            pingDisplay.innerHTML = `Ping ms : <span style="color: #ef4444;">LỖI</span>`;
            if (syncStatus) { syncStatus.textContent = 'LỖI WSS'; syncStatus.style.color = '#ef4444'; }
        }
        setTimeout(connectWebSocket, 3000); 
    };
}

if (liveRoomId) { connectWebSocket(); }

function updateNavigationUI() {
    if (!btnPrevBox || !btnNextBox) return;
    
    allBoxes.sort((a, b) => a.end_time - b.end_time);
    const currentIndex = allBoxes.findIndex(b => b.end_time === endTime);
    
    if (currentIndex === -1) {
        if(nextBoxWrapper) nextBoxWrapper.style.display = 'none';
        btnPrevBox.style.display = 'none'; btnNextBox.style.display = 'none';
        return;
    }

    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < allBoxes.length - 1;

    if (hasPrev || hasNext) {
        if(nextBoxWrapper) nextBoxWrapper.style.display = 'flex';
        if (hasPrev) { btnPrevBox.style.display = 'flex'; if (prevBoxCount) prevBoxCount.textContent = currentIndex; } else { btnPrevBox.style.display = 'none'; }
        if (hasNext) { btnNextBox.style.display = 'flex'; if (nextBoxCount) nextBoxCount.textContent = (allBoxes.length - 1 - currentIndex); } else { btnNextBox.style.display = 'none'; }
    } else {
        if(nextBoxWrapper) nextBoxWrapper.style.display = 'none';
        btnPrevBox.style.display = 'none'; btnNextBox.style.display = 'none';
    }
}

function loadBox(targetBox) {
    if (!targetBox) return;
    endTime = targetBox.end_time; paramM = targetBox.m; 
    
    recordBoxOpen(endTime);
    
    const parts = targetBox.r_params.split('|');
    if (parts.length >= 1 && parts[0]) coins = parseInt(parts[0]) || 0;
    if (parts.length >= 2 && parts[1]) canOpen = parseInt(parts[1]) || 0;
    if (parts.length >= 3) hotBoxStr = parts[2] || '🏅🇩🇪';
    if (parts.length >= 4) latestViewersStr = parts[3] || '';
    
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('m', targetBox.m);
    newUrl.searchParams.set('r', targetBox.r_params);
    window.history.replaceState({}, '', newUrl);

    if (usernameDisplayEl) usernameDisplayEl.textContent = targetBox.m;
    if (viewCountEl) viewCountEl.textContent = coins;
    if (peopleCountEl) peopleCountEl.textContent = canOpen;
    if (hotBoxFlagEl) hotBoxFlagEl.textContent = hotBoxStr;
    if (viewersDisplayEl) viewersDisplayEl.textContent = latestViewersStr;
    if (endTimeDisplayEl) endTimeDisplayEl.textContent = formatEndTimeHHMMSS(endTime);
    
    if (countdownEl) { countdownEl.style.fontSize = ''; countdownEl.style.color = ''; }
    document.body.style.backgroundColor = ''; currentBgState = 'default';
    
    setupRoomViewers(endTime); updateNavigationUI(); forceUpdateClock(); pushHeartbeat();
}

if (btnNextBox) { btnNextBox.addEventListener('click', () => { const currentIndex = allBoxes.findIndex(b => b.end_time === endTime); if (currentIndex !== -1 && currentIndex < allBoxes.length - 1) { loadBox(allBoxes[currentIndex + 1]); } }); }
if (btnPrevBox) { btnPrevBox.addEventListener('click', () => { const currentIndex = allBoxes.findIndex(b => b.end_time === endTime); if (currentIndex > 0) { loadBox(allBoxes[currentIndex - 1]); } }); }

function applySyncState(state) {
    if (state) {
        isSyncOn = true;
        if (!isT3 && syncStatus) { syncStatus.textContent = 'WSS...'; syncStatus.style.color = '#f59e0b'; }
        if (!isT3) { safeSetItem('isSyncOn', 'true'); }
        if (ws && ws.readyState === 1) { ws.send(JSON.stringify({ action: 'ping', client_time: getAccurateTime() })); }
    } else {
        isSyncOn = false; networkTimeOffset = 0; 
        if (!isT3 && syncStatus) { syncStatus.textContent = 'OFF'; syncStatus.style.color = '#ef4444'; }
        if (!isT3 && pingDisplay) { pingDisplay.innerHTML = `Ping ms : --`; }
        if (!isT3) { safeSetItem('isSyncOn', 'false'); }
    }
}

if (isT3) { applySyncState(true); }
if (btnSync) { btnSync.addEventListener('click', function() { applySyncState(!isSyncOn); }); }

function getCurrentTimeMs() { return getAccurateTime() + (isSyncOn ? networkTimeOffset : 0); }

let colorConfig = { active: false, start: 0.6, end: 0.0, color: '#ff0000' };
let currentBgState = 'default';

function updateConfigDisplayUI() {
    if (!activeConfigDisplay) return;
    if (colorConfig && colorConfig.active) {
        if(configColorDot) configColorDot.style.backgroundColor = colorConfig.color;
        if(configText) configText.textContent = `Từ ${colorConfig.start}s đến ${colorConfig.end}s`;
        activeConfigDisplay.style.display = 'flex'; 
    } else { activeConfigDisplay.style.display = 'none'; }
}

function applyBackgroundColor(state, colorHex = '') {
    if (isT3) return;
    if (state === 'default') {
        document.body.style.backgroundColor = ''; 
        const card = document.querySelector('.app-card'); if(card) card.style.backgroundColor = ''; 
        document.documentElement.style.removeProperty('--text-main');
        document.documentElement.style.removeProperty('--text-muted');
    } else if (state === 'flash') {
        document.body.style.backgroundColor = colorHex;
        const card = document.querySelector('.app-card'); if(card) card.style.backgroundColor = colorHex;
    }
    updateDTOffset();
}

(function loadSavedState() {
    try {
        var savedOffset = safeGetItem('timeOffset');
        if (savedOffset) { timeOffset = parseFloat(savedOffset); if (isNaN(timeOffset)) timeOffset = 0; }
        var savedLink1 = safeGetItem('link1');
        if (savedLink1 && savedLink1 !== 'null') { link1 = savedLink1; }

        var savedConfigStr = safeGetItem('colorConfig');
        if (savedConfigStr && !isT3) {
            colorConfig = JSON.parse(savedConfigStr);
            if (startSecondsEl) startSecondsEl.value = colorConfig.start;
            if (endSecondsEl) endSecondsEl.value = colorConfig.end;
            if (hexBgColorEl) hexBgColorEl.value = colorConfig.color;
        }

        var savedWsUrl = safeGetItem('ws_url');
        if (savedWsUrl && wsUrlInputEl) { wsUrlInputEl.value = savedWsUrl; }

        if (!isT3) {
            var savedSync = safeGetItem('isSyncOn');
            if (savedSync === 'true') applySyncState(true); else applySyncState(false);
        }

        let savedName = safeGetItem('myName');
        if (savedName && nameInputEl) { nameInputEl.value = savedName; pushNameToFirebase(savedName); }
        if(!isT3) updateConfigDisplayUI(); 
        applyBackgroundColor('default');
    } catch (e) {}
})();

function updateDTOffset() {
    if (!dTEl) return;
    const absVal = Math.abs(timeOffset);
    let sign = ''; let color = '';
    if (timeOffset > 0) { sign = '+'; color = '#22c55e'; } 
    else if (timeOffset < 0) { sign = '-'; color = '#ef4444'; } 
    else { sign = ''; color = isT3 ? '#1e293b' : (getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#1e293b'); }
    dTEl.innerHTML = '<b style="color:' + color + '">' + sign + absVal.toFixed(2) + 's</b>';
}

function formatTimeMMSSF(totalSeconds) {
    const absSec = Math.abs(totalSeconds);
    const seconds = Math.floor(absSec);
    const milliseconds = Math.floor((absSec - Math.floor(absSec)) * 1000);
    const f = String(Math.floor(milliseconds / 100));
    return String(seconds) + '.' + f;
}

let lastCountdownText = ""; let lastServerTimeText = ""; let isPingDisplayFrozen = false;

function forceUpdateClock() { updateClock(true); }

function updateClock(force = false) {
    if (!endTime) {
        if (countdownEl && lastCountdownText !== '0.0') { countdownEl.textContent = '0.0'; lastCountdownText = '0.0'; }
        if (isT3 && serverTimeDisplayEl && lastServerTimeText !== '--:--:--') { serverTimeDisplayEl.textContent = '--:--:--'; lastServerTimeText = '--:--:--'; }
        return;
    }

    const now = getCurrentTimeMs();
    const endTimeMs = endTime * 1000;
    
    const secretAdminOffsetMs = adminOffset * 1000;
    const adjustedEndMs = endTimeMs + (timeOffset * 1000) + secretAdminOffsetMs;
    const diffMs = adjustedEndMs - now;

    if (diffMs <= 0) {
        if (countdownEl && lastCountdownText !== '0.0') { countdownEl.textContent = '0.0'; lastCountdownText = '0.0'; }
        if (isT3) {
            const finalSTimeText = formatEndTimeHHMMSS(adjustedEndMs / 1000);
            if (serverTimeDisplayEl && lastServerTimeText !== finalSTimeText) { serverTimeDisplayEl.textContent = finalSTimeText; lastServerTimeText = finalSTimeText; }
            if (pingDisplay && !isPingDisplayFrozen) { pingDisplay.innerHTML = `<span style="font-weight: 600; color: #64748b;">Đã hết giờ !</span>`; isPingDisplayFrozen = true; }
        }
        if (!isT3 && currentBgState !== 'default') { currentBgState = 'default'; applyBackgroundColor('default'); }
        return; 
    }

    isPingDisplayFrozen = false;
    if (isT3 && serverTimeDisplayEl) {
        const sTimeText = formatEndTimeHHMMSS(now / 1000);
        if (lastServerTimeText !== sTimeText) { serverTimeDisplayEl.textContent = sTimeText; lastServerTimeText = sTimeText; }
    }

    const diffSeconds = diffMs / 1000;
    const displayedText = formatTimeMMSSF(diffSeconds);
    
    if (countdownEl && (lastCountdownText !== displayedText || force)) { 
        countdownEl.textContent = displayedText; lastCountdownText = displayedText;
    }

    if (!isT3 && colorConfig.active) {
        const currentDisplayNum = parseFloat(displayedText);
        if (currentDisplayNum <= colorConfig.start && currentDisplayNum >= colorConfig.end) {
            if (currentBgState !== 'flash') { currentBgState = 'flash'; applyBackgroundColor('flash', colorConfig.color); }
        } else {
            if (currentBgState !== 'default') { currentBgState = 'default'; applyBackgroundColor('default'); }
        }
    }
}

function adjustTime(seconds) {
    timeOffset += seconds; timeOffset = Math.round(timeOffset * 100) / 100;
    safeSetItem('timeOffset', String(timeOffset));
    updateDTOffset(); forceUpdateClock();
}

if (dec005) dec005.addEventListener('click', function () { adjustTime(-0.05); });
if (dec001) dec001.addEventListener('click', function () { adjustTime(-0.01); });
if (inc001) inc001.addEventListener('click', function () { adjustTime(0.01); });
if (inc005) inc005.addEventListener('click', function () { adjustTime(0.05); });

if (claimBtn) {
    claimBtn.addEventListener('click', function () {
        if (tiktokLink) { navigator.clipboard.writeText(tiktokLink).catch(function () {}); }
        if (link1) {
            fetch(link1, { mode: 'no-cors' }).catch(function () {});
            try { var newTab = window.open(link1, '_blank'); if (newTab) { setTimeout(function () { try { newTab.close(); } catch (e) {} }, 50); } } catch (e) {}
        }
    });
}

if (claimChangeBtn) {
    claimChangeBtn.addEventListener('click', function () {
        if (link1) {
            link1 = null; safeRemoveItem('link1'); alert('Đã xoá link(1)!');
        } else {
            var input = prompt('Nhập link(1):');
            if (input && input.trim() !== '') { link1 = input.trim(); safeSetItem('link1', String(link1)); alert('Đã lưu link(1): ' + link1); }
        }
    });
}

function handleConfirm(ok) { if (confirmModal) confirmModal.style.display = 'none'; }
if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', function () { handleConfirm(false); });
if (confirmOkBtn) confirmOkBtn.addEventListener('click', function () { handleConfirm(true); });

if(btnOpen) btnOpen.addEventListener('click', function () { if(modalEl) modalEl.style.display = 'flex'; });
if(btnCancel) btnCancel.addEventListener('click', function () { if(modalEl) modalEl.style.display = 'none'; });

if (btnSubmit) {
    btnSubmit.addEventListener('click', function () {
        if (!isT3) {
            const startVal = parseFloat(startSecondsEl.value);
            const endVal = parseFloat(endSecondsEl.value);
            colorConfig.start = isNaN(startVal) ? 0 : startVal;
            colorConfig.end = isNaN(endVal) ? 0 : endVal;
            colorConfig.color = hexBgColorEl.value;
            colorConfig.active = true;
            safeSetItem('colorConfig', JSON.stringify(colorConfig));
            updateConfigDisplayUI(); currentBgState = 'default'; applyBackgroundColor('default');
        }
        
        const wsUrlVal = wsUrlInputEl ? wsUrlInputEl.value.trim() : '';
        if (wsUrlVal) safeSetItem('ws_url', wsUrlVal); else safeRemoveItem('ws_url');

        if (isT3) {
            const nameVal = nameInputEl ? nameInputEl.value.trim() : '';
            if (nameVal && !nameInputEl.disabled) {
                safeSetItem('myName', nameVal); pushNameToFirebase(nameVal);
            }
        }

        if (modalEl) { modalEl.style.display = 'none'; if (wsUrlVal && (!ws || ws.url !== wsUrlVal)) location.reload(); }
    });
}

if (configDelBtn) {
    configDelBtn.addEventListener('click', function() {
        colorConfig.active = false; safeSetItem('colorConfig', JSON.stringify(colorConfig));
        updateConfigDisplayUI(); currentBgState = 'default'; applyBackgroundColor('default');
    });
}

if (modalEl) modalEl.addEventListener('click', function (e) { if (e.target === this) this.style.display = 'none'; });

updateDTOffset();

function clockLoop() {
    updateClock();
    requestAnimationFrame(clockLoop); 
}
requestAnimationFrame(clockLoop);
