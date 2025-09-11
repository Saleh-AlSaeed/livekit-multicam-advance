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

// طلب إذن (تلقائي + يمكن استدعاؤه يدويًا)
async function ensurePermissions() {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    setStatus('يجب فتح الصفحة عبر HTTPS للسماح بالكاميرا/المايك.');
    throw new Error('Not HTTPS');
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('المتصفح لا يدعم الوصول للكاميرا/المايك.');
    throw new Error('No mediaDevices');
  }
  try {
    setStatus('طلب إذن الكاميرا/المايك…');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach(t => t.stop());
    permissionsGranted = true;
    setStatus('تم منح الإذن. اختر الأجهزة ثم اضغط اتصال.');
    // إظهار القوائم بعد الإذن
    await listDevices();
  } catch (e) {
    console.error('Permission error:', e);
    permissionsGranted = false;
    setStatus('تم رفض الإذن أو حدث خطأ. اضغط زر "منح إذن الكاميرا/المايك" أو فعّل الإذن من إعدادات المتصفح للموقع.');
    // أظهر زر منح الإذن الاحتياطي
    const permBtn = document.getElementById('permBtn');
    if (permBtn) permBtn.style.display = 'inline-block';
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

    // fallback لآيفون لو ما فيه أي جهاز مرئي
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
    // لو ما عندنا إذن بعد (أو فشل تلقائياً) حاول مرة أخرى
    if (!permissionsGranted) {
      await ensurePermissions();
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

// تشغيل تلقائي عند الدخول للصفحة
document.addEventListener('DOMContentLoaded', async () => {
  ensureAuthCity();
  logoutBtnHandler(document.getElementById('logoutBtn'));

  // اربط الأزرار
  document.getElementById('permBtn')?.addEventListener('click', async () => {
    try { await ensurePermissions(); } catch (_) {}
  });
  document.getElementById('joinBtn')?.addEventListener('click', join);
  document.getElementById('leaveBtn')?.addEventListener('click', leave);

  // 1) حاول طلب الإذن تلقائيًا
  try {
    await ensurePermissions();   // إن نجح، سيتم أيضًا استدعاء listDevices() من داخله
  } catch {
    // 2) لو رُفض تلقائيًا، أظهر الزر الاحتياطي واملأ القوائم قدر الإمكان
    const permBtn = document.getElementById('permBtn');
    if (permBtn) permBtn.style.display = 'inline-block';
    await listDevices();
  }
});
