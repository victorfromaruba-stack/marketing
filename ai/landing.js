// The interest page: the hero's day of 24 keys, and the sign-up form.
import { seg } from './theme/seg.js';

// WhatsApp sign-ups: Victor's pick, digits only with the country code (297 for Aruba), e.g. '297xxxxxxx'.
// Empty means no WhatsApp button at all: a placeholder number must never reach a live page.
const WHATSAPP = '';
const TO = 'info@arubawebstudio.com';
const NEXT_CLASS = 'Level 1 starts Tue 24 Nov at 18:30';

const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Hero: an assistant is a job at an hour. Tap an hour; the chase light stops on every hour with a job. ──
   Demonstration jobs of what a Level 2 or 3 student's assistant can really do; the messages are illustrative. */
(function hero() {
  const JOBS = {
    7: ['Weather, wind and today’s calendar, sent to your phone.', 'Morning. 30° and windy, 32 km/h from the east. Dentist at 10:30, Level 1 class at 18:30.'],
    9: ['Checks your shop’s website is up and the menu is today’s.', 'Your site is up. The menu page still says Monday. Want me to draft today’s?'],
    13: ['Reads new email and drafts the replies. You approve each one.', '3 new emails. 2 replies drafted for you to check. Nothing sent.'],
    18: ['Drafts tomorrow’s post in English and Papiamento.', 'Tomorrow’s post is ready in English and Papiamento. Tap to read it first.'],
  };
  const EXTRA = [
    ['Builds tomorrow’s study plan from your timetable.', 'Maths test tomorrow, 2nd hour. 25 minutes of practice tonight. Plan attached.'],
    ['Watches the price of the flight you want.', 'The Miami flight you watch dropped to $289. Still yours to book.'],
    ['Backs up your notes folder and tells you it worked.', 'Backup done. 214 files, nothing changed since Tuesday.'],
    ['Sums up the group chat you muted.', 'The group chat in 4 lines: Saturday is still on, 9:00 at Baby Beach.'],
  ];
  const hh = (h) => String(h).padStart(2, '0');
  const keys = [...$('day').children];
  keys.forEach((k, h) => {
    k.setAttribute('aria-pressed', String(!!JOBS[h]));
    k.setAttribute('aria-label', `${hh(h)}:00${JOBS[h] ? `, ${JOBS[h][0]}` : ', no job yet'}`);
    k.onclick = () => {
      if (!JOBS[h]) {
        JOBS[h] = EXTRA.shift() || ['A job you write yourself in Level 3.', 'Your own job, your own words. Level 3.'];
        k.classList.add('lit');
        k.setAttribute('aria-pressed', 'true');
        k.setAttribute('aria-label', `${hh(h)}:00, ${JOBS[h][0]}`);
      }
      show(h, true);
      navigator.vibrate?.(10);
    };
  });
  let at = 7;
  function show(h, fromTap) {
    const [job, msg] = JOBS[h];
    $('clock').innerHTML = seg(`${hh(h)}:00`);
    $('clock').setAttribute('aria-label', `${hh(h)}:00`);
    $('ghost').innerHTML = seg(`${hh(h)}:00`);
    $('job').textContent = job;
    $('ptime').textContent = `${hh(h)}:00`;
    const n = $('note');
    n.classList.add('in');
    $('msg').textContent = msg;
    requestAnimationFrame(() => requestAnimationFrame(() => n.classList.remove('in')));
    if (fromTap) { keys[at].classList.remove('now'); at = h; keys[at].classList.add('now'); }
  }
  // The chase light: one hour per beat, stopping to send each job to the phone. Still under reduced motion.
  if (!reduced) setInterval(() => {
    keys[at].classList.remove('now');
    at = (at + 1) % 24;
    keys[at].classList.add('now');
    if (JOBS[at]) show(at);
  }, 520);
  // Pointer depth: the engraved hour, the plate and the phone move at different rates.
  if (!reduced && matchMedia('(hover: hover)').matches) addEventListener('pointermove', (e) => {
    document.documentElement.style.setProperty('--mx', (e.clientX / innerWidth - 0.5).toFixed(3));
    document.documentElement.style.setProperty('--my', (e.clientY / innerHeight - 0.5).toFixed(3));
  });
})();

/* ── Sign-up: handed to the visitor's own email app. No server, no form service. ──
   Taster mode: open the page with ?collect on Victor's own phone and each sign-up is also kept in this browser, with a
   JSON download in the footer. Otherwise nothing is stored. */
(function signup() {
  const KEY = 'aiCoursesInterest';
  const COLLECT = /[?&]collect\b/.test(location.search);
  const form = $('interest'), status = $('status'), saved = $('saved'), go = form.querySelector('button[type=submit]');
  const all = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  function jsonLink(data, name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = name;
    a.textContent = text;
    return a;
  }
  function showSaved() {
    saved.textContent = '';
    const list = COLLECT ? all() : [];
    if (!list.length) return;
    saved.append(`${list.length} ${list.length === 1 ? 'sign-up' : 'sign-ups'} saved on this device · `, jsonLink(list, 'ai-courses-interest.json', 'download JSON'));
  }
  // Reads and checks the form; on a gap it says what is missing, focuses it and keeps every field as typed.
  function read() {
    const fd = new FormData(form);
    const entry = {
      name: (fd.get('name') || '').trim(),
      contact: (fd.get('contact') || '').trim(),
      interest: fd.getAll('interest'),
      language: fd.get('language'),
      time: fd.getAll('time'),
      note: (fd.get('note') || '').trim(),
      at: new Date().toISOString(),
    };
    status.textContent = '';
    if (!entry.name || !entry.contact) {
      status.dataset.kind = 'err';
      status.textContent = 'Add your name and an email or WhatsApp number, so I can tell you the dates.';
      (entry.name ? form.contact : form.name).focus();
      return null;
    }
    if (COLLECT) {
      const list = all();
      list.push(entry);
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode: the message still carries it */ }
    }
    return entry;
  }
  const bodyOf = (e) => [
    `Name: ${e.name}`,
    `Email or WhatsApp: ${e.contact}`,
    `Interested in: ${e.interest.join(', ') || 'not sure yet'}`,
    `Language: ${e.language}`,
    `Best time: ${e.time.join(', ') || 'any'}`,
    e.note ? `Help with: ${e.note}` : '',
  ].filter(Boolean).join('\n');

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const entry = read();
    if (!entry) return;
    const href = `mailto:${TO}?subject=${encodeURIComponent(`AI courses list: ${entry.name}`)}&body=${encodeURIComponent(bodyOf(entry))}`;
    window.__lastMailto = href;
    go.classList.add('sending');
    setTimeout(() => go.classList.remove('sending'), 1500);
    status.dataset.kind = 'ok';
    status.innerHTML = '';
    status.append(`Your email app should open now with your answers filled in. It is only sent when you press send there. ${NEXT_CLASS}. If nothing opened, email `);
    const m = document.createElement('a');
    m.href = href;
    m.textContent = TO;
    status.append(m, ' or ', jsonLink(entry, 'my-ai-courses-answers.json', 'save your answers'), '.');
    showSaved();
    location.href = href;
  });

  // The WhatsApp route appears only once Victor has picked the number (WHATSAPP above). It opens a chat with the
  // answers typed in; nothing is sent until the visitor presses send in WhatsApp.
  const wa = $('wa');
  if (/^\d{8,15}$/.test(WHATSAPP)) {
    wa.hidden = false;
    wa.addEventListener('click', () => {
      const entry = read();
      if (!entry) return;
      const href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`AI courses list\n${bodyOf(entry)}`)}`;
      window.__lastWhatsApp = href;
      status.dataset.kind = 'ok';
      status.textContent = `WhatsApp should open now with your answers typed in. It is only sent when you press send there. ${NEXT_CLASS}.`;
      location.href = href;
    });
  }
  showSaved();
})();
