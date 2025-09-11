// ====== API helpers ======
const API = {
  async getConfig() {
    const r = await fetch('/api/config');
    return r.json();
  },

  async login(username, password) {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!r.ok) throw new Error('خطأ في الدخول');
    const data = await r.json();
    localStorage.setItem('session', JSON.stringify(data));
    return data;
  },

  session() {
    try {
      const s = localStorage.getItem('session');
      return s ? JSON.parse(s) : null;
    } catch (_) {
      return null;
    }
  },

  async logout() {
    try {
      const s = API.session();
      if (!s) return;
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + s.token }
      }).catch(() => {});
    } finally {
      try { localStorage.removeItem('session'); } catch (_) {}
    }
  },

  async token(roomName, identity, publish=false, subscribe=true) {
    const s = API.session();
    const r = await fetch('/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (s?.token ?? '')
      },
      body: JSON.stringify({ roomName, publish, subscribe, identity })
    });
    if (!r.ok) throw new Error('فشل إنشاء التوكن');
    return r.json();
  },

  async createWatch(selection) {
    const s = API.session();
    const r = await fetch('/api/create-watch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (s?.token ?? '')
      },
      body: JSON.stringify({ selection })
    });
    if (!r.ok) throw new Error('فشل إنشاء جلسة المشاهدة');
    return r.json();
  },

  async getActiveWatch() {
    const s = API.session();
    const r = await fetch('/api/watch/active', {
      headers: { 'Authorization': 'Bearer ' + (s?.token ?? '') }
    });
    return r.json();
  },

  async getWatch(id) {
    const s = API.session();
    const r = await fetch('/api/watch/' + id, {
      headers: { 'Authorization': 'Bearer ' + (s?.token ?? '') }
    });
    if (!r.ok) throw new Error('غير موجود');
    return r.json();
  }
};

// ====== Navigation helpers ======
function goTo(role, room) {
  if (role === 'admin') location.href = '/admin.html';
  else if (role === 'city') location.href = `/city.html?room=${encodeURIComponent(room)}`;
  else if (role === 'watcher') location.href = `/watchers.html`;
}

function requireAuth() {
  const s = API.session();
  if (!s) { location.href = '/'; return null; }
  return s;
}

function qs(k, def='') {
  const u = new URL(location.href);
  return u.searchParams.get(k) ?? def;
}

// ====== Logout binding (fixed) ======
function logoutBtnHandler(btn) {
  // إن لم يُمرر زر، نحاول إيجاده
  if (!btn) btn = document.getElementById('logoutBtn');
  if (!btn) return;

  // لمنع التكرار عند إعادة النداء
  btn._logoutBound && btn.removeEventListener('click', btn._logoutBound);

  const handler = async () => {
    try { await API.logout(); } catch (_) {}
    location.href = '/';
  };
  btn.addEventListener('click', handler);
  btn._logoutBound = handler;
}

// ✅ التفعيل التلقائي في كل صفحة تحتوي زر #logoutBtn
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('logoutBtn');
  if (btn) logoutBtnHandler(btn);
});
