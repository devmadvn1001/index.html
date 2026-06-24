import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, update, onValue, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ============================================================== //
// 0. BỌC THÉP HỆ THỐNG LƯU TRỮ (CHỐNG CRASH TRÊN TELEGRAM)       //
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
// 1. KHỞI TẠO CÁC BIẾN TOÀN CỤC TRƯỚC (CHỐNG LỖI TDZ)           //
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

// ============================================================== //
// 2. KẾT NỐI FIREBASE                                            //
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
// 3. TẠO ĐỊNH DANH MÁY (DEVICE ID) BẢO MẬT                       //
// ============================================================== //
let deviceId = safeGetItem('vip_device_id');
if (!deviceId) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomStr = (length) => Array.from({length}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    deviceId = `VIP-${randomStr(4)}-${randomStr(4)}`;
    safeSetItem('vip_device_id', deviceId);
}

const displayDeviceId = document.getElementById('displayDeviceId');
if (displayDeviceId) displayDeviceId.textContent = deviceId; // Ép in mã ra ngay lập tức

const btnCopyDeviceId = document.getElementById('btnCopyDeviceId');
if (btnCopyDeviceId) {
    btnCopyDeviceId.addEventListener('click', () => {
        navigator.clipboard.writeText(deviceId);
        btnCopyDeviceId.textContent = '✅ ĐÃ COPY MÃ';
        setTimeout(() => { btnCopyDeviceId.textContent = '📋 COPY MÃ GỬI ADMIN'; }, 2000);
    });
}

// ============================================================== //
// 4. LẮNG NGHE LỆNH TỪ LÃNH CHÚA (FREE MODE & KHÓA VIP)          //
// ============================================================== //
let isFreeMode = false;
let deviceStatus = 'unknown'; 
let adminOffset = 0; 
const deviceRef = ref(db, `devices/${deviceId}`);

function pushHeartbeat() {
    update(deviceRef, {
        last_active: Date.now(),
        current_task: {
            rate: paramM || 'Đang chờ...',
            coins: coins || 0,
            end_time: endTime || 0
        }
    }).catch(()=>{});
}

// Hàm kiểm tra Quyền truy cập (Xử lý Màn hình khóa)
function checkAccess() {
    const lockScreen = document.getElementById('vipLockScreen');
    const antiFlash = document.getElementById('antiFlash');
    if (antiFlash) antiFlash.remove(); // Xóa thẻ ép ẩn để nhường lại quyền cho JS điều khiển
    
    // Nếu bị Sếp khóa đích danh (Nút Khóa ở trang Admin) -> Chặn đứng, văng ra ngoài ngay
    if (deviceStatus === 'locked') {
        if (lockScreen) lockScreen.style.display = 'flex';
        safeSetItem('vip_access', 'false'); // Xóa trí nhớ
        return;
    }
    
    // Nếu Máy đã được cấp quyền VIP HOẶC Admin đang bật Công tắc Free Mode -> Mở cửa
    if (isFreeMode || deviceStatus === 'active') {
        if (lockScreen) lockScreen.style.display = 'none';
        safeSetItem('vip_access', 'true'); // Lưu trí nhớ là đã được vào
        pushHeartbeat(); 
    } else {
        // Chưa có quyền VIP và Admin đang khóa cửa -> Hiện màn đen
        if (lockScreen) lockScreen.style.display = 'flex';
        safeSetItem('vip_access', 'false'); // Xóa trí nhớ
    }
}

onValue(ref(db, 'global_settings/free_mode'), (snapshot) => {
    isFreeMode = !!snapshot.val();
    checkAccess();
});

onValue(deviceRef, (snapshot) => {
    const data = snapshot.val();
    const nameInputEl = document.getElementById('my-name-input');

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
onDisconnect(deviceRef).update({ last_active: Date.now() });

// ============================================================== //
// CÁC HÀM CỐT LÕI CỦA TOOL (KHÔNG THAY ĐỔI)
// ============================================================== //
const btnSwitchUI = document.getElementById('btn-switch-ui');
if (btnSwitchUI) {
    btnSwitchUI.addEventListener('click', () => {
        const currentUI = safeGetItem('active_ui', 'T1');
        const newUI = currentUI === 'T1' ? 'T3' : 'T1';
        safeSetItem('active_ui', newUI);
        const targetPage = newUI === 'T3' ? 't3.html' : 'index.html';
        window.location.href = targetPage + window.location.search;
    });
}

const myNameInput = document.getElementById('my-name-input');
const viewersList = document.getElementById('viewers-list');
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

    const savedName = myNameInput && myNameInput.value.trim() !== '' ? myNameInput.value : safeGetItem('myName');
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

if (myNameInput) {
    myNameInput.addEventListener('input', function() {
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
    const wrapper = document.getElementById('nextBoxWrapper');
    const btnPrev = document.getElementById('prevBoxBtn');
    const btnNext = document.getElementById('nextBoxBtn');
    const prevCount = document.getElementById('prevBoxCount');
    const nextCount = document.getElementById('nextBoxCount');
    
    if (!btnPrev || !btnNext) return;
    
    allBoxes.sort((a, b) => a.end_time - b.end_time);
    const currentIndex = allBoxes.findIndex(b => b.end_time === endTime);
    
    if (currentIndex === -1) {
        if(wrapper) wrapper.style.display = 'none';
        btnPrev.style.display = 'none'; btnNext.style.display = 'none';
        return;
    }

    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < allBoxes.length - 1;

    if (hasPrev || hasNext) {
        if(wrapper) wrapper.style.display = 'flex';
        if (hasPrev) { btnPrev.style.display = 'flex'; if (prevCount) prevCount.textContent = currentIndex; } else { btnPrev.style.display = 'none'; }
        if (hasNext) { btnNext.style.display = 'flex'; if (nextCount) nextCount.textContent = (allBoxes.length - 1 - currentIndex); } else { btnNext.style.display = 'none'; }
    } else {
        if(wrapper) wrapper.style.display = 'none';
        btnPrev.style.display = 'none'; btnNext.style.display = 'none';
    }
}

function loadBox(targetBox) {
    if (!targetBox) return;
    endTime = targetBox.end_time; paramM = targetBox.m; 
    
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

const btnNextEl = document.getElementById('nextBoxBtn'); const btnPrevEl = document.getElementById('prevBoxBtn');
if (btnNextEl) { btnNextEl.addEventListener('click', () => { const currentIndex = allBoxes.findIndex(b => b.end_time === endTime); if (currentIndex !== -1 && currentIndex < allBoxes.length - 1) { loadBox(allBoxes[currentIndex + 1]); } }); }
if (btnPrevEl) { btnPrevEl.addEventListener('click', () => { const currentIndex = allBoxes.findIndex(b => b.end_time === endTime); if (currentIndex > 0) { loadBox(allBoxes[currentIndex - 1]); } }); }

const btnSync = document.getElementById('btn-sync'); const syncStatus = document.getElementById('sync-status'); const pingDisplay = document.getElementById('pingDisplay'); 

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

const activeConfigDisplay = document.getElementById('activeConfigDisplay');
const configColorDot = document.getElementById('configColorDot');
const configText = document.getElementById('configText');

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
            if (document.getElementById('start_seconds')) document.getElementById('start_seconds').value = colorConfig.start;
            if (document.getElementById('end_seconds')) document.getElementById('end_seconds').value = colorConfig.end;
            if (document.getElementById('hex_background_color')) document.getElementById('hex_background_color').value = colorConfig.color;
        }

        var savedWsUrl = safeGetItem('ws_url');
        if (savedWsUrl && document.getElementById('ws_url_input')) { document.getElementById('ws_url_input').value = savedWsUrl; }

        if (!isT3) {
            var savedSync = safeGetItem('isSyncOn');
            if (savedSync === 'true') applySyncState(true); else applySyncState(false);
        }

        let savedName = safeGetItem('myName');
        if (savedName && myNameInput) { myNameInput.value = savedName; pushNameToFirebase(savedName); }
        if(!isT3) updateConfigDisplayUI(); 
        applyBackgroundColor('default');
    } catch (e) {}
})();

const countdownEl = document.getElementById('countdown');
const endTimeDisplayEl = document.getElementById('endTimeDisplay');
const serverTimeDisplayEl = document.getElementById('serverTimeDisplay');
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
if (endTimeDisplayEl) endTimeDisplayEl.textContent = formatEndTimeHHMMSS(endTime);

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

document.addEventListener("visibilitychange", function() {
    if (document.hidden) { if (myViewerRef) remove(myViewerRef); } 
    else {
        if (myNameInput && myNameInput.value.trim() !== '') { pushNameToFirebase(myNameInput.value); }
        pushHeartbeat(); 
    }
});

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
    
    // --- LÕI BÀN TAY CHÚA TỪ FIREBASE ---
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

const dec005 = document.getElementById('btn-decrease-0.05'); if (dec005) dec005.addEventListener('click', function () { adjustTime(-0.05); });
const dec001 = document.getElementById('btn-decrease-0.01'); if (dec001) dec001.addEventListener('click', function () { adjustTime(-0.01); });
const inc001 = document.getElementById('btn-increase-0.01'); if (inc001) inc001.addEventListener('click', function () { adjustTime(0.01); });
const inc005 = document.getElementById('btn-increase-0.05'); if (inc005) inc005.addEventListener('click', function () { adjustTime(0.05); });

const claimBtn = document.getElementById('claimBtn');
if (claimBtn) {
    claimBtn.addEventListener('click', function () {
        if (tiktokLink) { navigator.clipboard.writeText(tiktokLink).catch(function () {}); }
        if (link1) {
            fetch(link1, { mode: 'no-cors' }).catch(function () {});
            try { var newTab = window.open(link1, '_blank'); if (newTab) { setTimeout(function () { try { newTab.close(); } catch (e) {} }, 50); } } catch (e) {}
        }
    });
}

const claimChangeBtn = document.getElementById('claimChangeBtn');
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

function handleConfirm(ok) { var modal = document.getElementById('confirmModal'); if (modal) modal.style.display = 'none'; }
var confirmCancelBtn = document.getElementById('confirmCancelBtn'); var confirmOkBtn = document.getElementById('confirmOkBtn');
if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', function () { handleConfirm(false); });
if (confirmOkBtn) confirmOkBtn.addEventListener('click', function () { handleConfirm(true); });

const btnOpen = document.getElementById('btn-open'); if(btnOpen) btnOpen.addEventListener('click', function () { document.getElementById('modal').style.display = 'flex'; });
const btnCancel = document.getElementById('btn-cancel'); if(btnCancel) btnCancel.addEventListener('click', function () { document.getElementById('modal').style.display = 'none'; });

const btnSubmit = document.getElementById('btn-submit');
if (btnSubmit) {
    btnSubmit.addEventListener('click', function () {
        if (!isT3) {
            const startVal = parseFloat(document.getElementById('start_seconds').value);
            const endVal = parseFloat(document.getElementById('end_seconds').value);
            colorConfig.start = isNaN(startVal) ? 0 : startVal;
            colorConfig.end = isNaN(endVal) ? 0 : endVal;
            colorConfig.color = document.getElementById('hex_background_color').value;
            colorConfig.active = true;
            safeSetItem('colorConfig', JSON.stringify(colorConfig));
            updateConfigDisplayUI(); currentBgState = 'default'; applyBackgroundColor('default');
        }
        
        const wsUrlVal = document.getElementById('ws_url_input').value.trim();
        if (wsUrlVal) safeSetItem('ws_url', wsUrlVal); else safeRemoveItem('ws_url');

        if (isT3) {
            const nameVal = document.getElementById('my-name-input').value.trim();
            if (nameVal && !document.getElementById('my-name-input').disabled) {
                safeSetItem('myName', nameVal); pushNameToFirebase(nameVal);
            }
        }

        var modal = document.getElementById('modal');
        if (modal) { modal.style.display = 'none'; if (wsUrlVal && (!ws || ws.url !== wsUrlVal)) location.reload(); }
    });
}

const configDelBtn = document.getElementById('configDelBtn');
if (configDelBtn) {
    configDelBtn.addEventListener('click', function() {
        colorConfig.active = false; safeSetItem('colorConfig', JSON.stringify(colorConfig));
        updateConfigDisplayUI(); currentBgState = 'default'; applyBackgroundColor('default');
    });
}

const modalEl = document.getElementById('modal');
if (modalEl) modalEl.addEventListener('click', function (e) { if (e.target === this) this.style.display = 'none'; });

updateDTOffset();

function clockLoop() {
    updateClock();
    requestAnimationFrame(clockLoop); 
}
requestAnimationFrame(clockLoop);
