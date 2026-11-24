
// Event detail page: event loading, rendering, authentication, registration, and QR code.
// Load qrcode.min.js before this file in event.html.

(() => {
  const CONFIG = {
    API: 'https://localhost:8000/api',
    FILES: 'https://localhost:8000',
    TOKEN_KEY: 'token',
    LOGIN_URL: 'login.html',
    LIST_URL: 'index.html',
  };

  const $ = (s) => document.querySelector(s);

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));

  const TZ = 'Asia/Manila';

  const fmt = (d, o) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      ...o,
    }).format(new Date(d));

  const imgUrl = (p) =>
    /^https?:/i.test(p) ? p : CONFIG.FILES + p;

  const getToken = () => {
    try {
      return localStorage.getItem(CONFIG.TOKEN_KEY);
    } catch {
      return null;
    }
  };

  const state = {
    ev: null,
    me: null,
    reg: null,
    busy: false,
    error: '',
    image: 0,
  };

  // ─── User role ──────────────────────────────────────────

  function userRole() {
    // Supports either { role: "student" } or { user: { role: "student" } }
    return String(
      state.me?.role ?? state.me?.user?.role ?? ''
    ).trim().toLowerCase();
  }

  function canJoinEvent() {
    const role = userRole();

    return role === 'student' || role === 'guest';
  }

  // ─── Navigation + footer ────────────────────────────────

  // Supports both the older and newer HTML IDs.

  const logoLink = $('#NAVlogo a') || $('#logoLink');
  const navEvents = $('#NAVevents a') || $('#navEvents');
  const navLogin = $('#NAVaccount a') || $('#navLogin');

  const footerEvents =
    $('#fEvents') ||
    $('.footer__group:nth-of-type(1) li:nth-of-type(1) a');

  const footerLogin =
    $('#fLogin') ||
    $('.footer__group:nth-of-type(1) li:nth-of-type(4) a');

  if (logoLink) logoLink.href = CONFIG.LIST_URL;
  if (navEvents) navEvents.href = CONFIG.LIST_URL;
  if (navLogin) navLogin.href = CONFIG.LOGIN_URL;

  if (footerEvents) footerEvents.href = CONFIG.LIST_URL;
  if (footerLogin) footerLogin.href = CONFIG.LOGIN_URL;

  const logo = $('#NAVlogo img') || $('#logoImg');

  if (logo) {
    logo.addEventListener('error', () => {
      const t = document.createElement('span');

      t.className = 'logo-text';
      t.innerHTML = 'hnp<i>gnp</i>';

      logo.replaceWith(t);
    }, { once: true });
  }

  const navToggle = $('#NAVmenuToggle') || $('#navToggle');
  const navMenu = $('#NAVMenu') || $('#navMenu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', (e) => {
      const open = navMenu.classList.toggle('is-open');

      e.currentTarget.setAttribute(
        'aria-expanded',
        String(open)
      );
    });
  }

  // ─── API ────────────────────────────────────────────────

  async function api(path, method = 'GET') {
    const headers = {};
    const token = getToken();

    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }

    let res;

    try {
      res = await fetch(CONFIG.API + path, {
        method,
        headers,
      });
    } catch {
      throw Object.assign(
        new Error(
          'Can’t reach the server. Check that the API is running at ' +
          CONFIG.API + '.'
        ),
        { network: true }
      );
    }

    let data = null;

    try {
      data = await res.json();
    } catch {
      // Response has no JSON body.
    }

    if (!res.ok) {
      throw Object.assign(
        new Error(
          (data && data.message) ||
          'Something went wrong (' + res.status + ').'
        ),
        { status: res.status }
      );
    }

    return data;
  }

  // ─── Helpers ────────────────────────────────────────────

  function toast(msg) {
    const t = $('#toast');

    if (!t) return;

    t.textContent = msg;
    t.classList.add('show');

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      t.classList.remove('show');
    }, 3800);
  }

  const spots = () => {
    const taken = state.ev._count?.registrations ?? 0;
    const limit = state.ev.participantLimit || 0;

    return {
      taken,
      limit,
      left: Math.max(0, limit - taken),
    };
  };

  const organizerName = (o) =>
    o
      ? o.orgName ||
        o.fullName ||
        o.user?.fullName ||
        ''
      : '';

  const dateTime = (d) =>
    fmt(d, { dateStyle: 'long' }) +
    ' at ' +
    fmt(d, { timeStyle: 'short' });

  // ─── Event availability ─────────────────────────────────

  function availability() {
    const { ev, me, reg } = state;
    const role = userRole();

    // Organizers and admins cannot join events.
    // Check this before the registration check.
    if (me && ['organizer', 'admin'].includes(role)) {
      return {
        kind: 'restricted',
        why: role.charAt(0).toUpperCase() +
          role.slice(1) +
          ' accounts cannot join events.',
      };
    }

    // Already registered.
    if (reg) {
      return { kind: 'joined' };
    }

    // Event status checks.
    if (ev.status === 'cancelled') {
      return {
        kind: 'blocked',
        why: 'This event was cancelled.',
      };
    }

    if (ev.status === 'completed') {
      return {
        kind: 'blocked',
        why: 'This event has ended.',
      };
    }

    if (ev.status === 'ongoing') {
      return {
        kind: 'blocked',
        why: 'This event has already started, so registration is closed.',
      };
    }

    // Registration deadline check.
    if (new Date() > new Date(ev.registrationDeadline)) {
      return {
        kind: 'blocked',
        why:
          'Registration closed on ' +
          fmt(ev.registrationDeadline, {
            month: 'long',
            day: 'numeric',
          }) +
          '.',
      };
    }

    // Available slots check.
    if (spots().left <= 0) {
      return {
        kind: 'blocked',
        why: 'This event is full.',
      };
    }

    // User is not logged in.
    if (!me) {
      return { kind: 'login' };
    }

    // Only student and guest roles are allowed here.
    if (!canJoinEvent()) {
      return {
        kind: 'restricted',
        why: 'Your account is not allowed to join events.',
      };
    }

    return { kind: 'open' };
  }

  // ─── Rendering ──────────────────────────────────────────

  const ic = (d) =>
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    d +
    '</svg>';

  const icons = {
    venue: ic(
      '<path d="M12 21.5s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/>' +
      '<circle cx="12" cy="9.5" r="2.5"/>'
    ),

    when: ic(
      '<rect x="3" y="4.5" width="18" height="17" rx="2"/>' +
      '<path d="M8 2.5v4M16 2.5v4M3 10h18"/>'
    ),

    category: ic(
      '<path d="M3 12.5V4h8.5l9 9-8.5 8.5-9-9Z"/>' +
      '<circle cx="7.5" cy="8.5" r="1.2"/>'
    ),

    host: ic(
      '<circle cx="12" cy="8" r="4"/>' +
      '<path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'
    ),

    uni: ic(
      '<path d="m2 9 10-5 10 5-10 5L2 9Z"/>' +
      '<path d="M6 11.5v5c0 1.4 2.7 3 6 3s6-1.6 6-3v-5"/>'
    ),

    status: ic(
      '<circle cx="12" cy="12" r="9.5"/>' +
      '<path d="m8 12.5 2.7 2.7L16 9.5"/>'
    ),

    deadline: ic(
      '<circle cx="12" cy="12" r="9.5"/>' +
      '<path d="M12 6.5V12l3.5 2"/>'
    ),
  };

  const check =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2.6" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="10"/>' +
    '<path d="m8 12.5 2.7 2.7L16 9.5"/>' +
    '</svg>';

  function imageHtml(ev) {
    const imgs = ev.images || [];

    if (!imgs.length) return '';

    const i = Math.min(
      state.image,
      imgs.length - 1
    );

    const img =
      '<img src="' +
      esc(imgUrl(imgs[i].filePath)) +
      '" alt="' +
      esc(ev.title) +
      '">';

    if (imgs.length === 1) {
      return img;
    }

    return (
      '<button class="photo" type="button" id="nextPhoto" ' +
      'aria-label="Show next photo">' +
      img +
      '</button>' +
      '<span class="photo-count">' +
      (i + 1) +
      ' / ' +
      imgs.length +
      '</span>'
    );
  }

  // ─── Registration button rendering ──────────────────────

  function actionHtml(av) {
    const { ev, reg, me } = state;

    let html = '';

    if (av.kind === 'joined') {
      const checkedIn =
        reg.attendance && reg.attendance.isConfirm;

      html +=
        '<div class="joined">' +
        check +
        '<span>' +
        (checkedIn
          ? 'You’re checked in'
          : 'You’re registered') +
        '</span>' +
        '</div>';

      if (
        userRole() === 'student' &&
        me?.student?.qrToken &&
        !checkedIn &&
        ev.status !== 'completed' &&
        ev.status !== 'cancelled'
      ) {
        html +=
          '<div class="qr">' +
          '<div class="qr-box" id="qr"></div>' +
          '<p>Show this code at the entrance to check in.</p>' +
          '</div>';
      }

      if (
        ev.status === 'upcoming' &&
        !checkedIn
      ) {
        html +=
          '<button class="btn btn--ghost" id="cancelBtn" ' +
          'type="button"' +
          (state.busy ? ' disabled' : '') +
          '>Cancel registration</button>';
      }

    } else if (av.kind === 'open') {
      html +=
        '<button class="btn" id="joinBtn" type="button"' +
        (state.busy ? ' disabled' : '') +
        '>' +
        (
          state.busy
            ? '<span class="spin" aria-hidden="true"></span>Joining…'
            : 'Join this event'
        ) +
        '</button>';

    } else if (av.kind === 'login') {
      const next = encodeURIComponent(
        location.pathname.split('/').pop() +
        location.search
      );

      html +=
        '<a class="btn btn--solid-link" href="' +
        esc(CONFIG.LOGIN_URL) +
        '?next=' +
        next +
        '">Log in to join</a>';

      html +=
        '<p class="note">' +
        'Your account is how we keep track of who’s coming.' +
        '</p>';

    } else if (av.kind === 'restricted') {
      html +=
        '<button class="btn" type="button" disabled>' +
        'Registration unavailable' +
        '</button>';

      html +=
        '<p class="note">' +
        esc(av.why) +
        '</p>';

    } else {
      html +=
        '<button class="btn" type="button" disabled>' +
        'Registration closed' +
        '</button>';

      html +=
        '<p class="note">' +
        esc(av.why) +
        '</p>';
    }

    if (state.error) {
      html +=
        '<p class="note note--bad" role="alert">' +
        esc(state.error) +
        '</p>';
    }

    return html;
  }

  // ─── Main event rendering ───────────────────────────────

  function render() {
    const { ev } = state;

    if (!ev) return;

    const { taken, limit, left } = spots();

    const av = availability();

    const pct = limit
      ? Math.min(
          100,
          Math.round((taken / limit) * 100)
        )
      : 0;

    const host = organizerName(ev.organizer);

    document.title = ev.title + ' · HanapGanap';

    const rows = [
      [
        'venue',
        'Location',
        esc(ev.venue),
      ],

      [
        'when',
        'When',
        esc(dateTime(ev.startDatetime)) +
        ' to ' +
        esc(dateTime(ev.endDatetime)),
      ],

      ev.category?.name
        ? [
            'category',
            'Category',
            '<span class="category category--' +
            esc(
              ev.category.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
            ) +
            '">' +
            esc(ev.category.name) +
            '</span>',
          ]
        : null,

      host
        ? [
            'host',
            'Organizer',
            esc(host),
          ]
        : null,

      ev.university?.name
        ? [
            'uni',
            'University',
            esc(ev.university.name),
          ]
        : null,

      [
        'status',
        'Status',
        '<span class="status status--' +
        esc(ev.status) +
        '">' +
        esc(ev.status) +
        '</span>',
      ],

      [
        'deadline',
        'Register by',
        esc(dateTime(ev.registrationDeadline)),
      ],
    ].filter(Boolean);

    const app = $('#app');

    if (!app) return;

    app.innerHTML =
      '<section class="event">' +

        '<div class="event-image">' +
          imageHtml(ev) +
        '</div>' +

        '<div class="event-info">' +

          '<h1>' +
            esc(ev.title) +
          '</h1>' +

          '<div class="info-list">' +

            rows.map(([k, label, v]) =>
              '<p class="info-row">' +
                '<span class="info-label">' +
                  icons[k] +
                  label +
                '</span>' +
                '<span class="info-value">' +
                  v +
                '</span>' +
              '</p>'
            ).join('') +

          '</div>' +

          '<div class="join">' +

            '<div class="spots">' +
              '<span>' +
                (left <= 0 ? 'Full' : left + ' spots left') +
              '</span>' +

              '<span>' +
                taken +
                ' of ' +
                limit +
                ' joined' +
              '</span>' +
            '</div>' +

            '<div class="meter" role="img" aria-label="' +
              pct +
              ' percent of spots taken">' +
              '<i style="width:' +
                pct +
                '%"></i>' +
            '</div>' +

            '<div class="join-action">' +
              actionHtml(av) +
            '</div>' +

          '</div>' +

        '</div>' +

        '<div class="event-desc">' +
          '<h2>About this event</h2>' +
          '<p class="desc-text">' +
            esc(ev.description || 'No description yet.') +
          '</p>' +
        '</div>' +

      '</section>';

    bind();
    drawQr();
  }

  // ─── QR code ────────────────────────────────────────────

  function drawQr() {
    const box = $('#qr');

    if (!box) return;

    if (typeof QRCode === 'undefined') {
      box.parentElement?.remove();
      return;
    }

    new QRCode(box, {
      text: state.me.student.qrToken,
      width: 128,
      height: 128,
    });
  }

  // ─── Event listeners ────────────────────────────────────

  function bind() {
    const next = $('#nextPhoto');

    if (next) {
      next.addEventListener('click', () => {
        state.image =
          (state.image + 1) %
          state.ev.images.length;

        render();
      });
    }

    const join = $('#joinBtn');

    if (join) {
      join.addEventListener('click', onJoin);
    }

    const cancel = $('#cancelBtn');

    if (cancel) {
      cancel.addEventListener('click', onCancel);
    }
  }

  // ─── Actions ────────────────────────────────────────────

  async function refreshEvent() {
    try {
      state.ev = await api(
        '/events/' + state.ev.id
      );
    } catch {
      // Keep the current event information.
    }
  }

  async function onJoin() {
    // Extra frontend protection.
    // Organizers and admins cannot submit registration.
    if (!canJoinEvent()) {
      state.error =
        'Your account is not allowed to join events.';

      render();
      return;
    }

    state.busy = true;
    state.error = '';

    render();

    try {
      state.reg = await api(
        '/events/' + state.ev.id + '/register',
        'POST'
      );

      await refreshEvent();

      toast(
        'You’re in! See you at ' +
        state.ev.title +
        '.'
      );

    } catch (err) {
      if (err.status === 401) {
        state.me = null;

        state.error =
          'Your login has expired. Log in again to join.';

      } else {
        state.error = err.message;

        if (err.status === 409) {
          await refreshEvent();
        }
      }
    }

    state.busy = false;

    render();
  }

  function onCancel() {
    const dlg = $('#confirm');

    if (!dlg) {
      state.error =
        'The confirmation dialog could not be found.';

      render();
      return;
    }

    dlg.returnValue = '';
    dlg.showModal();

    dlg.addEventListener('close', async function handler() {
      dlg.removeEventListener('close', handler);

      if (dlg.returnValue !== 'cancel') {
        return;
      }

      state.busy = true;
      state.error = '';

      render();

      try {
        await api(
          '/events/' + state.ev.id + '/register',
          'DELETE'
        );

        state.reg = null;

        await refreshEvent();

        toast('Registration cancelled.');

      } catch (err) {
        state.error = err.message;
      }

      state.busy = false;

      render();
    });
  }

  // ─── Loading states ─────────────────────────────────────

  function showState(title, text, withRetry = false) {
    const app = $('#app');

    if (!app) return;

    app.innerHTML =
      '<div class="state">' +
        '<h1>' +
          esc(title) +
        '</h1>' +

        '<p>' +
          esc(text) +
        '</p>' +

        (
          withRetry
            ? '<button class="btn" id="retry" type="button">' +
              'Try again' +
              '</button>'
            : ''
        ) +

        '<a class="btn btn--ghost" href="' +
          esc(CONFIG.LIST_URL) +
        '">' +
          'Browse events' +
        '</a>' +

      '</div>';

    const r = $('#retry');

    if (r) {
      r.addEventListener('click', () => {
        location.reload();
      });
    }
  }

  // ─── Start ──────────────────────────────────────────────

  async function load() {
    const id = new URLSearchParams(
      location.search
    ).get('id');

    if (!id) {
      showState(
        'No event selected',
        'Open this page with an event id, for example event.html?id=5.'
      );

      return;
    }

    // Load event details.
    try {
      state.ev = await api(
        '/events/' + encodeURIComponent(id)
      );

    } catch (err) {
      if (err.status === 404) {
        showState(
          'Event not found',
          'It may have been removed. Browse the list to find another one.'
        );

      } else {
        showState(
          'Couldn’t load this event',
          err.message,
          true
        );
      }

      return;
    }

    // If logged in, get the user and their registrations.
    if (getToken()) {
      try {
        state.me = await api('/auth/me');

        const mine = await api(
          '/registrations/mine'
        );

        const list = Array.isArray(mine)
          ? mine
          : (mine.registrations || []);

        state.reg = list.find((r) =>
          (
            r.event &&
            String(r.event.id) === String(state.ev.id)
          ) ||
          String(r.eventId) === String(state.ev.id)
        ) || null;

      } catch (err) {
        if (err.status === 401) {
          state.me = null;
          state.reg = null;
        }
      }
    }

    render();
  }

  load();

})();
