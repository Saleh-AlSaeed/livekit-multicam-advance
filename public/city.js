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

async function requestPermissionsOnce() {
  if (permissionsGranted) return true;

  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    setStatus('❌ يجب فتح الصفحة عبر HTTPS.');
    return false;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('❌ المتصفح لا يدعم الكاميرا/المايك.');
    return false;
  }
  try {
    setStatus('🔔 طلب إذن الكاميرا/المايك…');
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    s.getTracks().forEach(t => t.stop());
    permissionsGranted = true;
    setStatus('✅ تم منح الإذن. اختر الأجهزة أو اضغط "اتصال".');
    return true;
  } catch (e) {
    console.error('Permission error:', e);
    setStatus('❌ رُفض الإذن. فعّل من إعدادات المتصفح للموقع، أو اضغط زر "منح الإذن".');
    document.getElementById('permBtn')?.removeAttribute('style');
    return false;
  }
}

async function listDevices() {
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    const camSel = document.getElementById('camSel');
    const micSel = document.getElementById('micSel');
    camSel.innerHTML = ''; micSel.innerHTML = '';

    const cams = devs.filter(d => d.kind === 'videoinput');
    const mics = devs.filter(d => d.kind === 'audioinput');

    cams.forEach((d, i) => {
      const o = document.createElement('option');
      o.value = d.deviceId || '';
      o.textContent = d.label?.trim() || (i===0 ? 'الكاميرا الأمامية (افتراضي)' : `كاميرا ${i+1}`);
      camSel.appendChild(o);
    });
    mics.forEach((d, i) => {
      const o = document.createElement('option');
      o.value = d.deviceId || '';
      o.textContent = d.label?.trim() || (i===0 ? 'مايك افتراضي' : `مايك ${i+1}`);
      micSel.appendChild(o);
    });

    if (cams.length === 0) {
      // iOS fallback
      const o1 = document.createElement('option'); o1.value='front'; o1.textContent='الكاميرا الأمامية'; camSel.appendChild(o1);
      const o2 = document.createElement('option'); o2.value='environment'; o2.textContent='الكاميرا الخلفية'; camSel.appendChild(o2);
    }
    setStatus('📋 الأجهزة جاهزة.');
  } catch (e) {
    console.error('enumerateDevices failed:', e);
    setStatus('❌ تعذر قراءة الأجهزة.');
  }
}

function buildVideoConstraints(choice) {
  if (choice === 'front') return { facingMode: 'user' };
  if (choice === 'environment') return { facingMode: { exact: 'environment' } };
  if (choice) return { deviceId: choice };
  return true;
}

async function join() {
  const s = ensureAuthCity();
  try {
    const ok = await requestPermissionsOnce();
    if (!ok) return;
    await listDevices();

    const roomName = qs('room');
    const identity = `${s.username}`;

    const camChoice = document.getElementById('camSel').value;
    const micChoice = document.getElementById('micSel').value;

    const videoConstraints = buildVideoConstraints(camChoice);
    const audioConstraints = micChoice ? { deviceId: micChoice } : true;

    setStatus('🎥 إنشاء المسارات المحلية…');
    localTracks = await createLocalTracks({ audio: audioConstraints, video: videoConstraints });

    setStatus('🔐 الحصول على توكن…');
    const tk = await API.token(roomName, identity, true, true);

    setStatus('🔌 الاتصال بـ LiveKit…');
    lkRoom = new Room({});
    await lkRoom.connect(tk.url, tk.token, { tracks: localTracks });

    const v = document.getElementById('preview');
    const vt = localTracks.find(t => t instanceof LocalVideoTrack);
    if (vt && v) vt.attach(v);

    document.getElementById('joinBtn').disabled = true;
    document.getElementById('leaveBtn').disabled = false;
    setStatus('✅ متصل وينشر الفيديو/الصوت.');
  } catch (e) {
    console.error('join failed:', e);
    setStatus('❌ فشل الاتصال: ' + (e?.name || e?.message || ''));
    alert('فشل الاتصال: ' + (e?.message || e));
  }
}

async function leave() {
  try {
    if (lkRoom) { lkRoom.disconnect(); lkRoom = null; }
    localTracks.forEach(t => t.stop());
    localTracks = [];
    const v = document.getElementById('preview'); if (v) v.srcObject = null;
    document.getElementById('joinBtn').disabled = false;
    document.getElementById('leaveBtn').disabled = true;
    setStatus('↩️ تمت المغادرة.');
  } catch (e) {
    console.error('leave failed:', e);
    setStatus('❌ تعذر المغادرة.');
  }
}

// تشغيل تلقائي: اطلب الإذن فور الدخول (سيظهر زر منح الإذن إذا رُفض)
document.addEventListener('DOMContentLoaded', async () => {
  ensureAuthCity();
  logoutBtnHandler(document.getElementById('logoutBtn'));

  document.getElementById('permBtn')?.addEventListener('click', async () => {
    const ok = await requestPermissionsOnce();
    if (ok) await listDevices();
  });
  document.getElementById('joinBtn')?.addEventListener('click', join);
  document.getElementById('leaveBtn')?.addEventListener('click', leave);

  const ok = await requestPermissionsOnce();
  if (ok) await listDevices();
});
