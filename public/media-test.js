const out = document.getElementById('out');
const vid = document.getElementById('vid');
let curStream = null;

function log(o){ out.textContent += (typeof o==='string'? o: JSON.stringify(o,null,2)) + "\n"; out.scrollTop = out.scrollHeight; }

async function stopStream() {
  try { curStream?.getTracks().forEach(t=>t.stop()); } catch(_) {}
  curStream = null;
  try { vid.srcObject = null; } catch(_) {}
}

async function askPerm() {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    log('❌ الصفحة ليست HTTPS — لن يعمل getUserMedia');
    alert('لازم تفتح الصفحة عبر HTTPS');
    return;
  }
  try {
    log('🔔 طلب الإذن video+audio…');
    const s = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    s.getTracks().forEach(t=>t.stop());
    log('✅ تم منح الإذن');
  } catch (e) {
    log('❌ Permission error: ' + (e.name || '') + ' ' + (e.message || ''));
    alert('تم رفض الإذن/خطأ: ' + e.name);
  }
}

async function list() {
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    log('📋 الأجهزة:');
    devs.forEach(d=> log(` - kind=${d.kind} id=${d.deviceId||''} label=${d.label||''}`));
  } catch (e) {
    log('❌ enumerateDevices: ' + e.message);
  }
}

async function playFacing(mode) {
  try {
    await stopStream();
    log(`▶️ تشغيل facingMode=${mode}`);
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: mode },
      audio: true
    });
    curStream = s;
    vid.srcObject = s;
  } catch (e) {
    log('❌ playFacing error: ' + e.name + ' ' + e.message);
    alert('خطأ تشغيل: ' + e.name);
  }
}

document.getElementById('ask').addEventListener('click', askPerm);
document.getElementById('list').addEventListener('click', list);
document.getElementById('front').addEventListener('click', ()=>playFacing('user'));
document.getElementById('back').addEventListener('click', ()=>playFacing({ exact:'environment' }));
document.getElementById('stop').addEventListener('click', stopStream);

// معلومات مفيدة
log('UA: ' + navigator.userAgent);
log('HTTPS: ' + (location.protocol==='https:' || location.hostname==='localhost'));
log('mediaDevices: ' + !!navigator.mediaDevices);
