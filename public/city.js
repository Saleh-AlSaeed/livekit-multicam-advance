// City page controller (robust init + inline fallbacks)
const { Room, createLocalTracks, LocalVideoTrack } = window.livekit;

let lkRoom = null;
let localTracks = [];
let permissionsGranted = false;

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
  console.log('[CITY]', msg);
}

function ensureAuthCity() {
  const s = requireAuth();
  if (!s || s.role !== 'city') location.href = '/';
  return s;
}

// ربط آمن للأزرار (مع touch/pointer)
function bindTap(el, handler) {
  if (!el || typeof handler !== 'function') return;
  const safe = (e) => { try { e.preventDefault?.(); e.stopPropagation?.(); } catch(_){} handler(e); };
  el.addEventListener('click', safe);
  el.addEventListener('touchend', safe, { passive: false });
  el.addEventListener('pointerup', safe);
  // لتجنب التكرار لو أُعيدت التهيئة
  el._boundHandler && el.removeEventListener('click', el._boundHandler);
  el._boundHandler = safe;
}

async function ensurePermissions() {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    setStatus('هذه الصفحة يجب فتحها عبر HTTPS للسماح بالكاميرا/المايك.');
    alert('افتح الرابط عبر HTTPS.');
    throw new Error('Not HTTPS');
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('المتصفح لا يدعم getUserMedia أو مُعطل.');
    alert('المتصفح لا يدعم/حجب الكاميرا/المايك.');
    throw new Error('No mediaDevices');
  }
  try {
    setStatus('طلب إذن الكاميرا/المايك…');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach(t => t.stop());
    permissionsGranted = true;
    setStatus('تم منح الإذن. اختر الأجهزة ثم اضغط اتصال.');
  } catch (e) {
    console.error('Permission error:', e);
    setStatus('تم رفض الإذن أو حدث خطأ. فعّل الكاميرا/المايك من إعدادات المتصفح.');
    alert('يجب منح إذن الكاميرا/المايك من إعدادات المتصفح لهذا الموقع.');
    permissionsGranted = false;
    throw e;
  }
}

async function listDevices() {
  try {
    const devices = await navigator.mediaDevices?.enumerateDevices?.() ?? [];
    const camSel = document.getElementById('camSel');
    const micSel = document.getElementById('micSel');
    if (!camSel || !micSel) return;

    camSel.innerHTML = '';
    micSel.innerHTML = '';

    const cams = devices.filter(d => d.kind === 'videoinput');
    const mics = devices.filter(d => d.kind === 'audioinput');

    cams.forEach((d, idx) => {
      const o = document.createElement('option');
      o.value = d.deviceId || '';
      o.textContent = d.label?.trim() || (idx === 0 ? 'الكاميرا الأمامية (افتراضي)' : `كاميرا ${idx+1}`);
      camSel.appendChild(o);
    });
    mics.forEach((d, idx) => {
      const o = document.createElement('option');
      o.value = d.deviceId || '';
      o.textContent = d.label?.trim() || (idx === 0 ? 'مايك افتراضي' : `مايك ${idx+1}`);
      micSel.appendChild(o);
    });

    if (cams.length === 0) {
      const o1 = document.createElement('option');
      o1.value = 'front';
      o1.textContent = 'الكاميرا الأمامية';
      camSel.appendChild(o1);
      const o2 = document.createElement('option');
      o2.value = 'environment';
      o2.textContent = 'الكاميرا الخلفية';
      camSel.appendChild(o2);
    }

    setStatus('الأجهزة جاهزة للاختيار.');
  } catch (e) {
    console.error('enumerateDevices failed:', e);
    setStatus('تعذر قراءة الأجهزة. تأكد من الإذن وفتح الصفحة عبر HTTPS.');
  }
}

async function join() {
  const s = ensureAuthCity();
  try {
    if (!permissionsGranted) {
      await ensurePermissions();
      await listDevices();
    }

    const roomName = qs('room');
    const identity = `${s.username}`;
    const camSel = document.getElementById('camSel');
    const micSel = document.getElementById('micSel');

    const camChoice = camSel?.value;
    const micChoice = micSel?.value;

    let videoConstraints;
    if (camChoice === 'front') {
      videoConstraints = { facingMode: 'user' };
    } else if (camChoice === 'environment') {
      videoConstraints = { facingMode: { exact: 'environment' } };
    } else if (camChoice) {
      videoConstraints = { deviceId: camChoice };
    } else {
      videoConstraints = true;
    }
    const audioConstraints = micChoice ? { deviceId: micChoice } : true;

    setStatus('إنشاء المسارات المحلية…');
    localTracks = await createLocalTracks({ audio: audioConstraints, video: videoConstraints });

    setStatus('الحصول على توكن LiveKit…');
    const tk = await API.token(roomName, identity, true, true);

    setStatus('الاتصال بالغرفة…');
    lkRoom = new Room({});
    await lkRoom.connect(tk.url, tk.token, { tracks: localTracks });

    const v = document.getElementById('preview');
    const vt = localTracks.find(t => t instanceof LocalVideoTrack);
    if (vt && v) vt.attach(v);

    document.getElementById('joinBtn').disabled = true;
    document.getElementById('leaveBtn').disabled = false;
    setStatus('متصل. يتم نشر الفيديو/الصوت.');
  } catch (e) {
    console.error('join failed:', e);
    setStatus('فشل الاتصال. راجع الأذونات أو الإعدادات.');
    alert('فشل الاتصال: ' + (e?.message || 'Unknown error'));
  }
}

async function leave() {
  try {
    if (lkRoom) { lkRoom.disconnect(); lkRoom = null; }
    localTracks.forEach(t => t.stop());
    localTracks = [];
    const v = document.getElementById('preview');
    if (v) { try { v.srcObject = null; } catch (_) {} }
    document.getElementById('joinBtn').disabled = false;
    document.getElementById('leaveBtn').disabled = true;
    setStatus('تمت المغادرة.');
  } catch (e) {
    console.error('leave failed:', e);
    setStatus('تعذر المغادرة، أعد تحميل الصفحة.');
  }
}

// --- Boot / bindings ---
function boot() {
  try {
    ensureAuthCity();
    logoutBtnHandler(document.getElementById('logoutBtn'));

    bindTap(document.getElementById('permBtn'), async () => {
      try {
        await ensurePermissions();
        await listDevices();
        alert('تم منح الإذن. اختر الكاميرا/المايك ثم اضغط اتصال.');
      } catch (_) {}
    });
    bindTap(document.getElementById('joinBtn'), join);
    bindTap(document.getElementById('leaveBtn'), leave);

    // Inline fallbacks
    window.__permClick = async () => { try { await ensurePermissions(); await listDevices(); } catch(_){} };
    window.__joinClick = () => { join(); };
    window.__leaveClick = () => { leave(); };

    // حاول تعبئة الأجهزة مباشرة (قد تكون بلا أسماء قبل الإذن)
    listDevices();
    setStatus('جاهز.');
  } catch (e) {
    console.error('boot error:', e);
    setStatus('خطأ تهيئة الصفحة. تحقق من وحدة التحكم (Console).');
  }
}

// شغّل على DOMContentLoaded وأيضًا صدِّره كـ fallback عالمي
document.addEventListener('DOMContentLoaded', boot);
window.__cityBoot = boot;
