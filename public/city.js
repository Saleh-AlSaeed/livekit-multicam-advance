const { Room, createLocalTracks, LocalVideoTrack } = window.livekit;
let lkRoom = null;
let localTracks = [];

// حالة الإذن
let permissionsGranted = false;

function ensureAuthCity() {
  const s = requireAuth();
  if (!s || s.role !== 'city') location.href = '/';
  return s;
}

async function ensurePermissions() {
  // طلب إذن الكاميرا/المايك. على iOS يلزم "gesture" (ضغط زر).
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,   // نطلب أي كاميرا
      audio: true    // وأي مايك
    });
    // نوقفها فوراً؛ الهدف فقط منح الإذن حتى تظهر الأجهزة وأسماؤها
    stream.getTracks().forEach(t => t.stop());
    permissionsGranted = true;
  } catch (e) {
    console.error('Permission error:', e);
    alert('لا بد من منح إذن الوصول للكاميرا والمايك من المتصفح.');
    permissionsGranted = false;
    throw e;
  }
}

async function listDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const camSel = document.getElementById('camSel');
    const micSel = document.getElementById('micSel');
    camSel.innerHTML = '';
    micSel.innerHTML = '';

    const cams = devices.filter(d => d.kind === 'videoinput');
    const mics = devices.filter(d => d.kind === 'audioinput');

    // في iOS قد لا تظهر أسماء قبل الإذن؛ لذلك نعرض اسمًا افتراضيًا
    cams.forEach((d, idx) => {
      const o = document.createElement('option');
      o.value = d.deviceId || '';
      o.textContent = (d.label && d.label.trim()) ? d.label : (idx === 0 ? 'الكاميرا الأمامية (افتراضي)' : `كاميرا ${idx+1}`);
      camSel.appendChild(o);
    });

    mics.forEach((d, idx) => {
      const o = document.createElement('option');
      o.value = d.deviceId || '';
      o.textContent = (d.label && d.label.trim()) ? d.label : (idx === 0 ? 'المايك الافتراضي' : `مايك ${idx+1}`);
      micSel.appendChild(o);
    });

    // إن لم توجد أي كاميرات بعد الإذن، نضيف خيارًا يعتمد facingMode
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

  } catch (e) {
    console.error('enumerateDevices failed:', e);
    alert('تعذر قراءة الأجهزة. تأكد من منح الإذن ومن فتح الصفحة عبر https.');
  }
}

async function join() {
  const s = ensureAuthCity();

  // إن لم نأخذ إذنًا بعد، خذه أولاً (مهم للجوال)
  if (!permissionsGranted) {
    await ensurePermissions();
    await listDevices();
  }

  const roomName = qs('room');
  const identity = `${s.username}`;

  const camSel = document.getElementById('camSel');
  const micSel = document.getElementById('micSel');

  const camChoice = camSel.value;
  const micChoice = micSel.value;

  // إعداد قيود فيديو تراعي iOS: إذا لم يوجد deviceId نستعمل facingMode
  let videoConstraints;
  if (camChoice === 'front') {
    videoConstraints = { facingMode: 'user' };
  } else if (camChoice === 'environment') {
    videoConstraints = { facingMode: { exact: 'environment' } };
  } else if (camChoice) {
    videoConstraints = { deviceId: camChoice };
  } else {
    videoConstraints = true; // اتركها للمتصفح يختار
  }

  // قيود الصوت
  const audioConstraints = micChoice ? { deviceId: micChoice } : true;

  // أنشئ التراكات المحلية بعد اختيار القيود
  localTracks = await createLocalTracks({
    audio: audioConstraints,
    video: videoConstraints
  });

  // احصل على توكن LiveKit
  const tk = await API.token(roomName, identity, true, true);

  // اتصل بالغرفة
  lkRoom = new Room({});
  await lkRoom.connect(tk.url, tk.token, { tracks: localTracks });

  // اعرض المعاينة
  const v = document.getElementById('preview');
  const vt = localTracks.find(t => t instanceof LocalVideoTrack);
  if (vt) vt.attach(v);

  document.getElementById('joinBtn').disabled = true;
  document.getElementById('leaveBtn').disabled = false;
}

async function leave() {
  if (lkRoom) { lkRoom.disconnect(); lkRoom = null; }
  localTracks.forEach(t => t.stop());
  localTracks = [];
  document.getElementById('joinBtn').disabled = false;
  document.getElementById('leaveBtn').disabled = true;
}

(function init() {
  ensureAuthCity();
  logoutBtnHandler(document.getElementById('logoutBtn'));

  // زر منح الإذن مناسب للجوال (Safari/Chrome يفضل "gesture")
  const permBtn = document.getElementById('permBtn');
  permBtn.addEventListener('click', async () => {
    await ensurePermissions();
    await listDevices();
    alert('تم منح الإذن. يمكنك الآن اختيار الكاميرا والمايك.');
  });

  // حاول عرض الأجهزة فورًا (قد لا تظهر أسماء بدون إذن)
  listDevices();

  document.getElementById('joinBtn').addEventListener('click', join);
  document.getElementById('leaveBtn').addEventListener('click', leave);
})();
