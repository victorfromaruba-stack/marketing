/* AI Courses Aruba, /ai: everything on the page except the hero field (field.js).
   1. The sticky key: after the hero, "Put your name down" stays one tap away, until the form itself is on screen.
   2. The lesson: the chase light steps through the four parts once, the first time they are on screen.
   3. The sign-up form: JSON to the form's data-endpoint, with every state drawn here (idle, sending, sent, error, offline).
   Reduced motion: the bar appears without sliding, the lesson is lit from the start, nothing blinks. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IO = 'IntersectionObserver' in window;

  /* 1. the sticky key */
  const bar = $('#bar');
  if (bar && IO) {
    let past = false, near = false;
    const set = () => { const on = past && !near; bar.classList.toggle('show', on); bar.inert = !on; };
    new IntersectionObserver(([e]) => { past = !e.isIntersecting && e.boundingClientRect.top < 0; set(); }, { rootMargin: '-64px 0px 0px 0px' }).observe($('#hero'));
    new IntersectionObserver(([e]) => { near = e.isIntersecting; set(); }, { threshold: 0.12 }).observe($('#join'));
  }

  /* 2. the lesson: unlit until seen, then one part per step of the clock (the LED switches, it never fades) */
  const prompt = $('.prompt');
  if (prompt && IO && !reduced) {
    const parts = [...prompt.querySelectorAll('.part')];
    prompt.classList.add('armed');
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      parts.forEach((p, i) => setTimeout(() => p.classList.add('on'), 350 + i * 420));
    }, { threshold: 0.55 });
    io.observe(prompt);
  }

  /* 3. the sign-up */
  const form = $('#join-form'), sent = $('#sent');
  if (!form) return;
  const WHATSAPP = '2977477794';   // +297 747 7794, the number on every Aruba Webstudio page (Victor, 31 Oct)
  const status = $('#status'), button = form.querySelector('button[type=submit]'), label = button.querySelector('.label');
  const el = { name: form.elements.name, whatsapp: form.elements.whatsapp, email: form.elements.email, consent: form.elements.consent };
  const picks = [...form.querySelectorAll('input[name=interest]')], group = $('#f-int');
  const demo = new URLSearchParams(location.search).get('demo');   // ?demo=sent|error|offline|slow: the states without a server, for checks
  // Which ad brought them: utm_content on the Meta ad links (taster, review-es, ...), '' when there is none. The server keeps
  // it only as a code of 40 at most; cut at 41 so a longer one is still refused there and can't push a sign-up past 4 KB.
  const src = (new URLSearchParams(location.search).get('utm_content') || '').slice(0, 41);
  // The taster's WhatsApp key carries the same code at the end of the message, so a seat saved there is counted too.
  const seat = $('.taster .seat');
  if (seat && src) seat.href += encodeURIComponent(` [${src.slice(0, 40)}]`);

  // What each field needs. '' means fine. Empty required fields are only flagged on send, never while someone is tabbing through.
  const rules = {
    name: () => el.name.value.trim() ? '' : 'Add your name.',
    whatsapp: () => {
      const v = el.whatsapp.value.trim(), digits = v.replace(/\D/g, '').length;
      if (!v) return 'Add your WhatsApp number, so Victor can message you.';
      return /^\+?[\d\s().-]+$/.test(v) && digits >= 7 && digits <= 15 ? '' : 'That doesn’t look like a phone number. Use digits, and a + before a country code.';
    },
    interest: () => picks.some((p) => p.checked) ? '' : 'Pick at least one.',
    email: () => { const v = el.email.value.trim(); return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Check the email, or leave it empty.'; },
    consent: () => el.consent.checked ? '' : 'Tick this so Victor may message you.',
  };
  const errOf = { name: 'e-name', whatsapp: 'e-wa', interest: 'e-int', email: 'e-email', consent: 'e-ok' };
  function mark(key, msg) {
    const err = document.getElementById(errOf[key]);
    err.textContent = msg; err.hidden = !msg;
    if (key === 'interest') group.toggleAttribute('data-invalid', !!msg);
    else el[key].setAttribute('aria-invalid', String(!!msg));
    return !msg;
  }
  const check = (key) => mark(key, rules[key]());
  const flagged = (key) => key === 'interest' ? group.hasAttribute('data-invalid') : el[key].getAttribute('aria-invalid') === 'true';
  // A press on the send key must land. Pressing it blurs the field, and a blur check that adds or removes an error line
  // moves the key under the finger between press and release, so the tap missed (6 Nov, found by the check). While the
  // key is held, blur checks wait; sending checks every field anyway.
  let pressing = false;
  button.addEventListener('pointerdown', () => { pressing = true; }, { passive: true });
  addEventListener('pointerup', () => setTimeout(() => { pressing = false; }), { capture: true, passive: true });
  addEventListener('pointercancel', () => { pressing = false; }, { capture: true, passive: true });
  for (const key of ['name', 'whatsapp', 'email']) {
    el[key].addEventListener('blur', () => { if (!pressing && (el[key].value.trim() || flagged(key))) check(key); });
    el[key].addEventListener('input', () => { if (flagged(key)) check(key); });
  }
  picks.forEach((p) => p.addEventListener('change', () => { if (flagged('interest')) check('interest'); }));
  el.consent.addEventListener('change', () => { if (flagged('consent')) check('consent'); });

  const answers = () => ({
    name: el.name.value.trim(),
    whatsapp: el.whatsapp.value.trim(),
    interests: picks.filter((p) => p.checked).map((p) => p.value),
    email: el.email.value.trim(),
    consent: el.consent.checked,
    website: form.elements.website.value,   // the honeypot: always empty from a person; the server drops any sign-up where it is not
    page: location.pathname,
    src,
  });
  // The way out when sending fails: the same answers, typed into a WhatsApp chat with Victor. Nothing is sent until they press send.
  const viaWhatsApp = (a) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent([
    'Hi Victor, please put my name down for AI Courses Aruba.', `Name: ${a.name}`, `WhatsApp: ${a.whatsapp}`,
    `Interested in: ${a.interests.join(', ')}`, a.email ? `Email: ${a.email}` : '',
  ].filter(Boolean).join('\n'))}`;

  function say(kind, text, link) {
    status.textContent = '';
    if (kind) status.dataset.kind = kind; else delete status.dataset.kind;
    if (!text) return;
    status.append(text);
    if (link) { const a = document.createElement('a'); a.href = link.href; a.textContent = link.text; status.append(' ', a, '.'); }
  }
  let state = 'idle';
  function setState(next, text, link) {
    state = next;
    form.dataset.state = next;
    button.setAttribute('aria-busy', String(next === 'sending'));
    label.textContent = next === 'sending' ? 'Sending…' : next === 'error' ? 'Try again' : 'Put my name down';
    if (next === 'sending') say('', 'Sending your answers…');
    else say(next === 'idle' ? '' : next, text || '', link);
  }

  async function send(data) {
    if (demo) {
      await new Promise((r) => setTimeout(r, demo === 'slow' ? 4000 : 900));
      return { ok: demo === 'sent' || demo === 'slow', status: demo === 'error' ? 503 : 200, json: async () => ({}) };
    }
    const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 15000);
    try {
      return await fetch(form.dataset.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data), signal: stop.signal, credentials: 'same-origin',
      });
    } finally { clearTimeout(timer); }
  }

  function done() {
    const first = el.name.value.trim().split(/\s+/)[0];
    $('#sent-h').textContent = first ? `You’re on the list, ${first}.` : 'You’re on the list.';
    form.hidden = true; sent.hidden = false;
    if (!reduced) { sent.classList.remove('play'); void sent.offsetWidth; sent.classList.add('play'); }
    $('#sent-h').focus({ preventScroll: true });
    sent.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    setState('idle');
  }

  async function failed(res, data) {
    const link = { href: viaWhatsApp(data), text: 'send them on WhatsApp instead' };
    if (res && res.status === 400) {   // the server may name the field it refused: { "field": "whatsapp", "error": "…" }
      try {
        const j = await res.json();
        if (j && rules[j.field] && typeof j.error === 'string') {
          mark(j.field, j.error.slice(0, 160));
          (j.field === 'interest' ? picks[0] : el[j.field]).focus();
          setState('idle'); return;
        }
      } catch { /* not JSON: the general message below */ }
    }
    if (res && res.status === 429) setState('error', 'Too many tries from this connection. Wait a minute and try again, or', link);
    else setState('error', 'That didn’t go through, and your answers are still here. Try again, or', link);
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (state === 'sending') return;
    const bad = Object.keys(rules).filter((k) => !check(k));
    if (bad.length) {
      (bad[0] === 'interest' ? picks[0] : el[bad[0]]).focus();
      setState('idle');
      say('err', bad.length === 1 ? 'One thing to fix above.' : `${bad.length} things to fix above.`);
      return;
    }
    const data = answers();
    if (data.website) { done(); return; }   // a bot filled the hidden field: it sees "sent", and nothing is sent
    if (!navigator.onLine || demo === 'offline') {
      setState('offline', 'You’re offline, so nothing was sent. Your answers are still here: press the button again once you’re back online, or', { href: viaWhatsApp(data), text: 'send them on WhatsApp' });
      return;
    }
    setState('sending');
    try {
      const res = await send(data);
      if (res.ok) done(); else await failed(res, data);
    } catch { await failed(null, data); }
  });

  addEventListener('online', () => { if (state === 'offline') setState('idle', 'You’re back online. Press the button to send.'); });
  $('#again').addEventListener('click', () => {
    form.reset();
    for (const k of Object.keys(rules)) mark(k, '');
    sent.hidden = true; form.hidden = false; setState('idle');
    el.name.focus();
  });
})();
