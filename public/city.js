
const { Room, createLocalTracks, LocalVideoTrack } = window.livekit;
let lkRoom = null;
let localTracks = [];

function ensureAuthCity() {
  const s = requireAuth();
  if (!s || s.role !== 'city') location.href = '/';
  return s;
}
async function listDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const camSel = document.getElementById('camSel');
  const micSel = document.getElementById('micSel');
  camSel.innerHTML = ''; micSel.innerHTML = '';
  devices.filter(d=>d.kind==='videoinput').forEach(d=>{
    const o = document.createElement('option'); o.value=d.deviceId; o.textContent=d.label||d.deviceId; camSel.appendChild(o);
  });
  devices.filter(d=>d.kind==='audioinput').forEach(d=>{
    const o = document.createElement('option'); o.value=d.deviceId; o.textContent=d.label||d.deviceId; micSel.appendChild(o);
  });
}
async function join() {
  const s = ensureAuthCity();
  const roomName = qs('room');
  const identity = `${s.username}`;
  const cameraId = document.getElementById('camSel').value || undefined;
  const micId = document.getElementById('micSel').value || undefined;
  localTracks = await createLocalTracks({ audio: { deviceId: micId }, video: { deviceId: cameraId } });
  const tk = await API.token(roomName, identity, true, true);
  lkRoom = new Room({});
  await lkRoom.connect(tk.url, tk.token, { tracks: localTracks });
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
  listDevices();
  document.getElementById('joinBtn').addEventListener('click', join);
  document.getElementById('leaveBtn').addEventListener('click', leave);
})();
