// ─── Settings: change these to match your project ───────
const CONFIG = {
  API: 'http://localhost:8000/api',    // base URL of the API (the API docs say http, not https)
  TOKEN_KEY: 'token',                  // localStorage key your login page saves the token under
  LOGIN_URL: 'login.html',             // where to send people who are not logged in
  LIST_URL: 'index.html',              // the events list page
  EVENT_URL: 'event.html',             // the event detail page (opened as event.html?id=5)
  LOGO_SRC: 'images/logo.png',         // your logo image (a text logo shows if it can't load)
};

// ─── Debug logging (open DevTools → Console) ────────────
console.log('[account] account.js loaded. API =', CONFIG.API);
window.addEventListener('error', (e) => console.error('[account] Uncaught error:', e.message, 'at', e.filename + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => console.error('[account] Unhandled promise rejection:', e.reason));

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'Asia/Manila';
const fmt = (d, o) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...o }).format(new Date(d));
const getToken = () => { try { return localStorage.getItem(CONFIG.TOKEN_KEY); } catch { return null; } };
const clearToken = () => { try { localStorage.removeItem(CONFIG.TOKEN_KEY); } catch { /* ignore */ } };
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

const state = {
  me: null,
  tab: '',
  regs: [],                          // student and guest
  events: [],                        // organizer
  open: new Set(), parts: new Map(), // organizer: open participant panels
  stats: null, users: [], unverifiedTotal: 0, // admin
};

// ─── Nav + footer wiring ────────────────────────────────
$('#logoLink').href = CONFIG.LIST_URL;
$('#navEvents').href = CONFIG.LIST_URL;
$('#fEvents').href = CONFIG.LIST_URL;
$('#navLogin').href = CONFIG.LOGIN_URL;
$('#fLogin').href = CONFIG.LOGIN_URL;
const logo = $('#logoImg');
logo.addEventListener('load', () => console.log('[logo] loaded OK:', logo.src));
logo.addEventListener('error', () => {
  console.error('[logo] FAILED to load:', logo.src, '— check the file exists at this path (relative to account.html)');
  const t = document.createElement('span');
  t.className = 'logo-text';
  t.innerHTML = 'hnp<i>gnp</i>';
  logo.replaceWith(t);
}, { once: true });
logo.src = CONFIG.LOGO_SRC;
console.log('[logo] trying:', logo.src);
$('#navToggle').addEventListener('click', (e) => {
  const open = $('#navMenu').classList.toggle('is-open');
  e.currentTarget.setAttribute('aria-expanded', open);
});

// ─── API ────────────────────────────────────────────────
async function api(path, opts = {}) {
  const { method = 'GET', body, blob = false } = opts;
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const url = CONFIG.API + path;
  const started = performance.now();
  console.log('[api] →', method, url, token ? '(token sent)' : '(NO token)');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000); // never hang forever
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    console.error('[api] ✗ no response from', url, timedOut ? '(timed out after 10s)' : '', err);
    console.error('[api] Likely causes: backend not running, wrong port/protocol (http vs https), or CORS not allowing this page’s origin (' + location.origin + ').');
    throw Object.assign(new Error(timedOut
      ? 'The server took too long to respond.'
      : 'Can’t reach the server. Check that the API is running at ' + CONFIG.API + '.'), { network: true });
  } finally {
    clearTimeout(timer);
  }
  console.log('[api] ←', res.status, method, path, Math.round(performance.now() - started) + 'ms');
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    console.error('[api] ✗ server returned an error:', res.status, data);
    throw Object.assign(new Error((data && data.message) || 'Something went wrong (' + res.status + ').'), { status: res.status });
  }
  if (blob) return res.blob();
  try { return await res.json(); } catch { return null; }
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3800);
}

// ─── Small building blocks ──────────────────────────────
const ic = (d) => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const I = {
  mail: ic('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  id: ic('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.6 1.8-2.4 3-2.4s2.4.8 3 2.4M15 10h3M15 14h3"/>'),
  book: ic('<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>'),
  uni: ic('<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11.5v5c0 1.4 2.7 3 6 3s6-1.6 6-3v-5"/>'),
  org: ic('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>'),
  phone: ic('<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/>'),
  cal: ic('<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>'),
};

const tabsHtml = (tabs, current) =>
  '<div class="tabs" role="tablist">' + tabs.map((t) =>
    '<button type="button" role="tab" data-tab="' + t.id + '" aria-selected="' + (t.id === current) + '">' + esc(t.label) + '<span class="count">' + t.count + '</span></button>'
  ).join('') + '</div>';

const statsHtml = (items) =>
  '<div class="stats">' + items.map(([n, label, hot]) =>
    '<div class="stat' + (hot ? ' stat--hot' : '') + '"><b>' + esc(n) + '</b><span>' + esc(label) + '</span></div>'
  ).join('') + '</div>';

const dateBox = (d) => '<div class="datebox"><b>' + esc(fmt(d, { day: 'numeric' })) + '</b><span>' + esc(fmt(d, { month: 'short' })) + '</span></div>';
const whenText = (ev) => fmt(ev.startDatetime, { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + fmt(ev.startDatetime, { timeStyle: 'short' });
const eventLink = (ev) => CONFIG.EVENT_URL + '?id=' + encodeURIComponent(ev.id);

// The API may not include a status on registrations, so work it out from the dates if needed
function statusOf(ev) {
  if (ev.status) return ev.status;
  const now = Date.now();
  const s = ev.startDatetime ? +new Date(ev.startDatetime) : 0;
  const e = ev.endDatetime ? +new Date(ev.endDatetime) : 0;
  if (s && now < s) return 'upcoming';
  if (e && now > e) return 'completed';
  return s ? 'ongoing' : 'upcoming';
}
const groupOf = (st) => (st === 'ongoing' ? 'ongoing' : st === 'upcoming' ? 'upcoming' : 'past');
const byStart = (dir) => (a, b) => dir * (+new Date(a.startDatetime) - +new Date(b.startDatetime));

// ─── Shell: profile column ──────────────────────────────
function profileRows(me) {
  const rows = [['mail', 'Email', esc(me.email) + (me.emailVerified === false ? '<small>Not verified yet</small>' : '')]];
  const s = me.student, o = me.organizer, a = me.admin, g = me.guest;
  if (s) {
    if (s.university?.name) rows.push(['uni', 'University', esc(s.university.name)]);
    if (s.studentNumber) rows.push(['id', 'Student number', esc(s.studentNumber)]);
    if (s.courseProgram) rows.push(['book', 'Course', esc(s.courseProgram)]);
    if (s.yearLevel) rows.push(['book', 'Year level', esc(s.yearLevel) + ' year']);
  }
  if (o) {
    if (o.orgName) rows.push(['org', 'Organization', esc(o.orgName)]);
    if (o.university?.name) rows.push(['uni', 'University', esc(o.university.name)]);
  }
  if (a && a.university?.name) rows.push(['uni', 'University', esc(a.university.name)]);
  if (g) {
    if (g.contactNumber) rows.push(['phone', 'Contact number', esc(g.contactNumber)]);
    if (g.schoolOrAffiliation) rows.push(['uni', 'School or affiliation', esc(g.schoolOrAffiliation)]);
  }
  if (me.createdAt) rows.push(['cal', 'Member since', esc(fmt(me.createdAt, { month: 'long', year: 'numeric' }))]);
  return rows;
}

function renderShell() {
  const me = state.me;
  const initial = (me.fullName || '?').trim().charAt(0).toUpperCase();
  const rows = profileRows(me);
  document.title = me.fullName + ' · HanapGanap';
  $('#app').innerHTML =
    '<div class="account">' +
      '<aside class="profile" aria-label="Your details">' +
        '<div class="avatar" aria-hidden="true">' + esc(initial) + '</div>' +
        '<h1>' + esc(me.fullName) + '</h1>' +
        '<span class="role role--' + esc(me.role) + '">' + esc(me.role) + '</span>' +
        '<div class="info-list">' +
          rows.map(([k, label, v]) => '<p class="info-row"><span class="info-label">' + I[k] + esc(label) + '</span><span class="info-value">' + v + '</span></p>').join('') +
        '</div>' +
        '<button class="btn btn--ghost btn--block" id="logout" type="button">Log out</button>' +
      '</aside>' +
      '<section class="content" id="content" aria-live="polite"><p>Loading…</p></section>' +
    '</div>';

  $('#logout').addEventListener('click', () => { clearToken(); location.href = CONFIG.LOGIN_URL; });
  $('#content').addEventListener('click', onContentClick);
}

// ─── Student and guest: events joined + certificates ────
function attendeeRowHtml(r) {
  const ev = r.event, st = statusOf(ev);
  const checked = r.attendance && r.attendance.isConfirm;
  let tag = '';
  if (checked) tag = '<span class="tag tag--ok">' + (st === 'completed' ? 'Attended' : 'Checked in') + '</span>';
  else if (st === 'completed') tag = '<span class="tag">Didn’t check in</span>';
  return '<li class="item">' + dateBox(ev.startDatetime) +
    '<div><a class="item-title" href="' + esc(eventLink(ev)) + '">' + esc(ev.title) + '</a>' +
    '<p class="item-meta">' + esc(whenText(ev)) + '</p><p class="item-meta">' + esc(ev.venue || '') + '</p></div>' +
    '<div class="item-side"><span class="status status--' + esc(st) + '">' + esc(st) + '</span>' + tag + '</div></li>';
}

function renderAttendee() {
  const regs = state.regs.filter((r) => r.event);
  const groups = { ongoing: [], upcoming: [], past: [] };
  regs.forEach((r) => groups[groupOf(statusOf(r.event))].push(r));
  groups.ongoing.sort((a, b) => byStart(1)(a.event, b.event));
  groups.upcoming.sort((a, b) => byStart(1)(a.event, b.event));
  groups.past.sort((a, b) => byStart(-1)(a.event, b.event));

  // Students see only their current events (ongoing + upcoming) and certificates.
  // Guests keep the Past tab.
  const isStudent = state.me.role === 'student';
  if (!state.tab) {
    state.tab = groups.ongoing.length ? 'ongoing'
      : (groups.upcoming.length || isStudent) ? 'upcoming'
      : groups.past.length ? 'past'
      : 'ongoing';
  }

  const certs = regs.filter((r) => r.certificateAvailable);
  const current = groups.ongoing.length + groups.upcoming.length;
  const tiles = isStudent
    ? [
        [current, 'Current events'],
        [groups.ongoing.length, 'Happening now', groups.ongoing.length > 0],
        [certs.length, 'Certificates'],
      ]
    : [
        [regs.length, 'Events joined'],
        [groups.ongoing.length, 'Happening now', groups.ongoing.length > 0],
        [regs.filter((r) => r.attendance && r.attendance.isConfirm).length, 'Events attended'],
      ];

  const tabs = [
    { id: 'ongoing', label: 'Ongoing', count: groups.ongoing.length },
    { id: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
  ];
  if (!isStudent) tabs.push({ id: 'past', label: 'Past', count: groups.past.length });

  const empty = {
    ongoing: 'Nothing is happening right now.',
    upcoming: 'You haven’t joined any upcoming events. <a href="' + esc(CONFIG.LIST_URL) + '">Browse events</a>',
    past: 'No past events yet.',
  };
  const list = groups[state.tab] || [];

  let html = statsHtml(tiles) +
    '<section class="section"><h2>' + (isStudent ? 'My current events' : 'My events') + '</h2>' +
    tabsHtml(tabs, state.tab) +
    (list.length ? '<ul class="items">' + list.map(attendeeRowHtml).join('') + '</ul>' : '<p class="empty">' + empty[state.tab] + '</p>') +
    '</section>';

  if (isStudent) {
    html += '<section class="section"><h2>My certificates</h2>' +
      (certs.length
        ? '<ul class="items">' + certs.map((r) => {
            const ev = r.event;
            return '<li class="item">' + dateBox(ev.startDatetime) +
              '<div><a class="item-title" href="' + esc(eventLink(ev)) + '">' + esc(ev.title) + '</a>' +
              '<p class="item-meta">Participation certificate</p></div>' +
              '<div class="item-side"><button class="btn btn--sm" type="button" data-cert="' + esc(ev.id) + '" data-title="' + esc(ev.title) + '">Download PDF</button></div></li>';
          }).join('') + '</ul>'
        : '<p class="empty">No certificates yet. You get one after an event ends and the organizer has confirmed you attended.</p>') +
      '</section>';
  }
  $('#content').innerHTML = html;
}

async function downloadCertificate(btn) {
  const id = btn.dataset.cert, label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Preparing…';
  try {
    const blob = await api('/events/' + encodeURIComponent(id) + '/certificate', { blob: true });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'certificate-' + (btn.dataset.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pdf';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (err) {
    toast(err.message);
  }
  btn.disabled = false; btn.textContent = label;
}

// ─── Organizer: events created + participants ───────────
function isMine(ev) {
  const me = state.me, oid = me.organizer?.id;
  return [ev.organizer?.id, ev.organizerId].some((x) => x != null && x === oid) ||
    ev.organizer?.userId === me.id || ev.organizer?.user?.id === me.id;
}

function participantsPanel(id) {
  const d = state.parts.get(id);
  if (!d || d.loading) return '<div class="panel"><p>Loading participants…</p></div>';
  if (d.error) return '<div class="panel"><p>' + esc(d.error) + '</p></div>';
  const list = d.participants || [];
  if (!list.length) return '<div class="panel"><p>No one has joined yet.</p></div>';
  const rows = list.map((p) => {
    const u = p.user || p;
    const prof = u.student || p.student || u.guest || p.guest || {};
    const detail = prof.studentNumber || prof.schoolOrAffiliation || prof.contactNumber || '';
    const inTime = p.attendance?.inTime || p.inTime || p.checkInTime;
    return '<tr><td>' + esc(u.fullName || p.fullName || '—') + (u.email ? '<small>' + esc(u.email) + '</small>' : '') + '</td>' +
      '<td>' + esc(u.role || p.role || '') + '</td><td>' + esc(detail) + '</td>' +
      '<td>' + (inTime ? esc(fmt(inTime, { month: 'short', day: 'numeric' }) + ', ' + fmt(inTime, { timeStyle: 'short' })) : 'Not yet') + '</td></tr>';
  }).join('');
  return '<div class="panel"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Details</th><th>Checked in</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

function renderOrganizer() {
  const evs = state.events;
  const groups = { upcoming: [], ongoing: [], past: [] };
  evs.forEach((e) => groups[groupOf(statusOf(e))].push(e));
  if (!state.tab) state.tab = 'all';
  const total = evs.reduce((n, e) => n + (e._count?.registrations ?? 0), 0);
  const list = (state.tab === 'all' ? evs.slice() : groups[state.tab].slice())
    .sort(byStart(state.tab === 'upcoming' || state.tab === 'ongoing' ? 1 : -1));

  const items = list.map((ev) => {
    const st = statusOf(ev), n = ev._count?.registrations ?? 0, limit = ev.participantLimit || 0;
    const pct = limit ? Math.min(100, Math.round((n / limit) * 100)) : 0;
    const open = state.open.has(ev.id);
    return '<li class="item">' + dateBox(ev.startDatetime) +
      '<div><a class="item-title" href="' + esc(eventLink(ev)) + '">' + esc(ev.title) + '</a>' +
        '<p class="item-meta">' + esc(whenText(ev)) + '</p><p class="item-meta">' + esc(ev.venue || '') + '</p></div>' +
      '<div class="item-side"><span class="status status--' + esc(st) + '">' + esc(st) + '</span></div>' +
      '<div class="item-extra">' +
        '<div class="joined-line"><span><strong>' + n + '</strong> of ' + limit + ' joined</span>' +
        '<button class="btn btn--sm btn--ghost" type="button" data-part="' + esc(ev.id) + '" aria-expanded="' + open + '">' + (open ? 'Hide participants' : 'View participants') + '</button></div>' +
        '<div class="meter" role="img" aria-label="' + pct + ' percent of spots taken"><i style="width:' + pct + '%"></i></div>' +
        (open ? participantsPanel(ev.id) : '') +
      '</div></li>';
  }).join('');

  $('#content').innerHTML =
    statsHtml([
      [evs.length, 'Events created'],
      [total, 'Total participants'],
      [groups.upcoming.length, 'Upcoming'],
      [groups.ongoing.length, 'Happening now', groups.ongoing.length > 0],
    ]) +
    '<section class="section"><h2>My events</h2>' +
    tabsHtml([
      { id: 'all', label: 'All', count: evs.length },
      { id: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
      { id: 'ongoing', label: 'Ongoing', count: groups.ongoing.length },
      { id: 'past', label: 'Past', count: groups.past.length },
    ], state.tab) +
    (items ? '<ul class="items">' + items + '</ul>' : '<p class="empty">' + (evs.length ? 'No events in this tab.' : 'You haven’t created any events yet.') + '</p>') +
    '</section>';
}

async function togglePart(id) {
  if (state.open.has(id)) { state.open.delete(id); renderOrganizer(); return; }
  state.open.add(id);
  if (!state.parts.has(id)) {
    state.parts.set(id, { loading: true });
    renderOrganizer();
    try { state.parts.set(id, await api('/events/' + encodeURIComponent(id) + '/participants')); }
    catch (err) { state.parts.set(id, { error: err.message }); }
  }
  renderOrganizer();
}

// ─── Admin: dashboard ───────────────────────────────────
const barsHtml = (data, order, red) => {
  const max = Math.max(1, ...order.map((k) => data?.[k] ?? 0));
  return order.map((k) => {
    const v = data?.[k] ?? 0;
    return '<div class="bar"><span>' + esc(k) + '</span><div class="bar-track"><div class="bar-fill' + (red ? ' bar-fill--red' : '') + '" style="width:' + Math.round((v / max) * 100) + '%"></div></div><b>' + v + '</b></div>';
  }).join('');
};

function renderAdmin() {
  const st = state.stats || {};
  const regs = st.registrations ?? 0, att = st.attended ?? 0;
  const rate = regs ? Math.round((att / regs) * 100) + '%' : '—';
  const users = state.users;

  $('#content').innerHTML =
    statsHtml([
      [st.users?.total ?? 0, 'Users'],
      [st.events?.total ?? 0, 'Events'],
      [regs, 'Registrations'],
      [att, 'Attended (' + rate + ')'],
      [st.activeUniversities ?? 0, 'Active universities'],
      [st.users?.unverified ?? 0, 'Unverified users', (st.users?.unverified ?? 0) > 0],
    ]) +
    '<div class="two">' +
      '<section class="section"><h2>Users by role</h2>' + barsHtml(st.users?.byRole, ['student', 'organizer', 'guest', 'admin'], false) + '</section>' +
      '<section class="section"><h2>Events by status</h2>' + barsHtml(st.events?.byStatus, ['upcoming', 'ongoing', 'completed', 'cancelled'], true) + '</section>' +
    '</div>' +
    '<section class="section"><h2>Needs email verification' + (state.unverifiedTotal ? ' <small>showing ' + users.length + ' of ' + state.unverifiedTotal + '</small>' : '') + '</h2>' +
    (users.length
      ? '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th></th></tr></thead><tbody>' +
        users.map((u) => '<tr><td>' + esc(u.fullName) + '<small>' + esc(u.email) + '</small></td><td>' + esc(u.role) + '</td>' +
          '<td><button class="btn btn--sm" type="button" data-verify="' + esc(u.id) + '">Verify</button></td></tr>').join('') +
        '</tbody></table></div>'
      : '<p class="empty">Everyone is verified.</p>') +
    '</section>';
}

async function verifyUser(btn) {
  const id = btn.dataset.verify;
  btn.disabled = true;
  try {
    await api('/admin/users/' + encodeURIComponent(id), { method: 'PATCH', body: { emailVerified: true } });
    state.users = state.users.filter((u) => String(u.id) !== String(id));
    state.unverifiedTotal = Math.max(0, state.unverifiedTotal - 1);
    if (state.stats?.users) state.stats.users.unverified = Math.max(0, (state.stats.users.unverified || 0) - 1);
    toast('Email verified.');
    renderAdmin();
  } catch (err) {
    toast(err.message);
    btn.disabled = false;
  }
}

// ─── Wiring ─────────────────────────────────────────────
function render() {
  const role = state.me.role;
  if (role === 'organizer') renderOrganizer();
  else if (role === 'admin') renderAdmin();
  else renderAttendee();
}

function onContentClick(e) {
  const tab = e.target.closest('[data-tab]');
  if (tab) { state.tab = tab.dataset.tab; render(); return; }
  const cert = e.target.closest('[data-cert]');
  if (cert) { downloadCertificate(cert); return; }
  const part = e.target.closest('[data-part]');
  if (part) { togglePart(part.dataset.part); return; }
  const ver = e.target.closest('[data-verify]');
  if (ver) verifyUser(ver);
}

async function loadRole() {
  const role = state.me.role;
  console.log('[data] loading data for role:', role);
  if (role === 'organizer') {
    const all = await api('/events');
    const list = Array.isArray(all) ? all : (all.events || []);
    state.events = list.filter(isMine);
  } else if (role === 'admin') {
    const [stats, users] = await Promise.all([api('/admin/stats'), api('/admin/users?verified=false&limit=8')]);
    state.stats = stats;
    state.users = users?.users || [];
    state.unverifiedTotal = users?.total ?? state.users.length;
  } else {
    const mine = await api('/registrations/mine');
    state.regs = Array.isArray(mine) ? mine : (mine.registrations || []);
  }
  render();
}

function showLogin(msg) {
  const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
  $('#app').innerHTML = '<div class="state"><h1>Log in to see your account</h1><p>' + esc(msg || 'Your events, certificates and details are tied to your account.') + '</p>' +
    '<a class="btn" href="' + esc(CONFIG.LOGIN_URL) + '?next=' + next + '">Log in</a></div>';
}

function showError(err) {
  $('#app').innerHTML = '<div class="state"><h1>Couldn’t load your account</h1><p>' + esc(err.message) + '</p>' +
    '<button class="btn" id="retry" type="button">Try again</button></div>';
  $('#retry').addEventListener('click', () => location.reload());
}

async function init() {
  console.log('[init] starting. token present:', !!getToken(), '(localStorage key: "' + CONFIG.TOKEN_KEY + '")');
  if (!getToken()) {
    console.warn('[init] no token found, so the login prompt is shown. Does your login page save the token under "' + CONFIG.TOKEN_KEY + '"?');
    showLogin();
    return;
  }
  try {
    state.me = await api('/auth/me');
    console.log('[init] logged in as', state.me.email, '| role:', state.me.role);
  } catch (err) {
    console.error('[init] /auth/me failed:', err.status || 'no status', err.message);
    if (err.status === 401) { clearToken(); showLogin('Your login has expired. Log in again.'); }
    else showError(err);
    return;
  }
  renderShell();
  try {
    await loadRole();
    console.log('[init] page rendered OK');
  } catch (err) {
    console.error('[init] loading data for role "' + state.me.role + '" failed:', err);
    $('#content').innerHTML = '<p class="empty">' + esc(err.message) + '</p>';
  }
}

init().catch((err) => {
  console.error('[init] crashed:', err);
  showError(err);
});