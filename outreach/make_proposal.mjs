#!/usr/bin/env node
/**
 * Aruba Web Studio. Per-business proposal PDF
 *   node outreach/make_proposal.mjs <slug>
 * Reads intake/<slug>.json, writes outreach/proposals/<slug>-proposal.pdf
 *
 * Rendered with Chromium so the PDF uses the same design language as the sites.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: node outreach/make_proposal.mjs <slug>'); process.exit(2); }

const p = resolve(ROOT, 'intake', `${slug}.json`);
if (!existsSync(p)) { console.error(`no intake file: ${p}`); process.exit(2); }
const d = JSON.parse(readFileSync(p, 'utf8'));

const name   = d.business_name || slug;
const owner  = d.owner_name || '';
const demo   = d.build?.demo_url || `https://demo.arubawebstudio.com/${slug}`;
const hook   = d.the_hook || {};
const search = hook.search_term || '';
const rivals = (hook.who_outranks_them || []).filter(Boolean);
const comm   = hook.commission_paid_to || '';
const prob   = hook.observed_problem || '';
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* the sector-specific money argument */
let caseFor;
const sector = d.sector || '';
if (/Tour|Watersport|Guesthouse|Rental/i.test(sector)) {
  caseFor = `You are paying ${esc(comm || 'a booking platform 15–25%')} on bookings that come through them.
    A booking form on your own site costs you nothing per booking. One direct booking a month
    covers the whole year of this.`;
} else if (/Restaurant|Bar|Food/i.test(sector)) {
  caseFor = `Google cannot read a menu posted as a photo. When a visitor searches
    &ldquo;restaurants near me&rdquo; from their hotel at 8pm, you do not appear. Not because
    you rank badly, but because there is nothing to rank.`;
} else if (/Trade|Contractor|Auto/i.test(sector)) {
  caseFor = `People search for what you do at the moment it breaks, usually at night, usually on
    a phone. That search is happening now and it is going to whoever shows up first.`;
} else {
  caseFor = `Three out of four people judge whether a business is credible by its website.
    When someone is referred to you, the first thing they do is look you up.`;
}

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font:14px/1.62 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B1A26;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;padding:0 0 4mm;position:relative;page-break-after:always;overflow:hidden}
.page:last-child{page-break-after:auto}
.hero{background:linear-gradient(135deg,#0A2F4E 0%,#12496F 55%,#1C7FA8 100%);color:#fff;padding:11mm 18mm 11mm}
.kicker{font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;opacity:.72;margin-bottom:5mm}
h1{font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.15;font-weight:600;margin-bottom:3.5mm}
.sub{font-size:14px;color:#fff;opacity:.92;max-width:132mm}
.body{padding:9mm 18mm 0}
h2{font-family:Georgia,serif;font-size:18px;color:#0A2F4E;margin:6mm 0 2.6mm;font-weight:600}
h2:first-child{margin-top:0}
p{margin-bottom:3mm;color:#2B3E4D}
.callout{background:#EAF3F6;border-left:3px solid #1C7FA8;padding:3.4mm 5mm;margin:3.4mm 0;border-radius:0 7px 7px 0}
.callout strong{color:#0A2F4E}
.demo{background:#0A2F4E;color:#fff;padding:6mm;border-radius:9px;margin:5mm 0;text-align:center}
.demo .lbl{font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;opacity:.66;margin-bottom:2.5mm}
.demo .url{font-size:16px;color:#7FD4E8;word-break:break-all;font-weight:600}
.demo .note{font-size:11.5px;opacity:.76;margin-top:3mm}
table{width:100%;border-collapse:collapse;margin:4mm 0;font-size:12px}
th{background:#0A2F4E;color:#fff;padding:2.6mm 3mm;text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase}
th:not(:first-child),td:not(:first-child){text-align:center;width:26mm}
td{padding:1.9mm 3mm;border-bottom:1px solid #E3EAEF}
tr:nth-child(even) td{background:#F8FAFB}
.price td{font-weight:700;color:#0A2F4E;font-size:15px;background:#EAF3F6!important}
.rec{position:relative}
.rec::after{content:'MOST POPULAR';position:absolute;top:-3.5mm;left:50%;transform:translateX(-50%);
  background:#FF7A45;color:#fff;font-size:7.5px;letter-spacing:.13em;padding:1mm 2.5mm;border-radius:3px;white-space:nowrap}
ul{margin:0 0 3mm 5mm}li{margin-bottom:1.6mm;color:#2B3E4D}
.bundle{background:#FFF4EF;border:1.5px solid #FF7A45;border-radius:9px;padding:5mm;margin:5mm 0}
.bundle h3{color:#D9481F;font-size:15px;margin-bottom:2.5mm}
.foot{margin:6mm 18mm 0;padding-top:3mm;border-top:1px solid #E3EAEF;
  font-size:10.5px;color:#7A8B99;display:flex;justify-content:space-between}
.sig{margin-top:5mm;padding-top:4mm;border-top:1px solid #E3EAEF}
.sig .nm{font-weight:700;color:#0A2F4E;font-size:15px}
.sig .ct{color:#1C7FA8;font-size:13px;margin-top:1mm}
</style></head><body>

<div class="page">
  <div class="hero">
    <svg viewBox="0 0 240 240" width="56" height="56" style="margin-bottom:3mm"><g transform="translate(0.0,0.0) scale(0.31024) translate(-124.7,-124.7)"><path d="M 499 155 L 422 166 L 361 188 L 298 226 L 253 266 L 209 323 L 178 385 L 160 451 L 155 523 L 164 592 L 188 661 L 228 727 L 270 773 L 325 815 L 391 847 L 451 863 L 521 868 L 591 859 L 661 835 L 727 795 L 775 751 L 817 695 L 849 627 L 865 561 L 868 496 L 857 423 L 833 357 L 800 302 L 755 251 L 702 210 L 641 179 L 573 160 Z M 488 178 L 548 179 L 619 195 L 678 222 L 732 261 L 776 308 L 808 358 L 830 410 L 845 487 L 844 548 L 832 606 L 810 661 L 771 721 L 727 766 L 661 810 L 599 834 L 535 845 L 477 844 L 411 830 L 351 804 L 294 764 L 253 722 L 219 672 L 193 612 L 178 534 L 180 469 L 197 399 L 227 337 L 263 289 L 316 241 L 370 209 L 423 189 Z" fill="#FFC06B" fill-rule="evenodd"/><path d="M 286 381 L 282 390 L 325 390 L 326 395 L 311 416 L 271 423 L 258 436 L 307 437 L 310 463 L 322 490 L 415 634 L 433 677 L 433 695 L 354 695 L 354 710 L 606 710 L 606 695 L 542 695 L 393 508 L 387 483 L 395 473 L 435 472 L 480 488 L 511 509 L 514 518 L 563 542 L 548 561 L 756 561 L 741 545 L 700 541 L 678 529 L 633 527 L 593 538 L 558 525 L 557 518 L 806 518 L 794 505 L 742 499 L 732 487 L 719 483 L 720 478 L 775 478 L 754 462 L 667 458 L 658 445 L 549 448 L 539 442 L 539 436 L 738 436 L 721 422 L 649 415 L 640 404 L 610 395 L 611 390 L 661 390 L 648 377 L 601 372 L 585 362 L 548 354 L 549 349 L 613 349 L 593 334 L 524 330 L 519 317 L 508 313 L 415 316 L 374 325 L 334 343 L 330 349 L 364 350 L 359 361 L 342 372 Z M 504 479 L 568 478 L 588 492 L 558 494 L 530 504 Z M 415 444 L 425 436 L 469 436 L 508 445 L 520 455 L 482 469 L 447 454 L 416 449 Z M 336 437 L 377 436 L 378 441 L 352 470 Z M 462 402 L 468 390 L 505 391 L 496 403 Z M 344 414 L 362 390 L 440 391 L 431 403 L 372 403 L 363 415 Z" fill="#FFFDF9" fill-rule="evenodd"/></g></svg>
    <div class="kicker">Prepared for ${esc(name)}</div>
    <h1>A website built for ${esc(name)}${owner ? `,<br>ready to look at today` : ''}</h1>
    <p class="sub">Not a mock-up. A working site, already live, that you can open on your phone right now.</p>
  </div>

  <div class="body">
    <h2>Why I built this before asking you anything</h2>
    <p>${owner ? `Hi ${esc(owner)}. ` : ''}You have probably been pitched a website before, and
    probably by someone who wanted a meeting first. I would rather show you the thing than
    describe it. So it is built, it is live, and if you do not want it I will take it down.</p>

    ${search || rivals.length || prob ? `<div class="callout">
      <p style="margin:0"><strong>What I noticed</strong><br>
      ${search ? `I searched <strong>&ldquo;${esc(search)}&rdquo;</strong> on Google.
        ${rivals.length ? `${esc(rivals.join(', '))} came up. ${esc(name)} did not.` : `${esc(name)} did not come up.`}` : ''}
      ${prob ? `<br>${esc(prob)}` : ''}</p>
    </div>` : ''}

    <p>${caseFor}</p>

    <p>Aruba had <strong>1,515,102 stopover visitors last year</strong>, three out of four American,
    spending an average of <strong>US$1,949</strong> each. They plan on Google before they land,
    and they never see local Facebook pages.</p>

    <div class="demo" style="padding:5mm;margin:4mm 0">
      <div class="lbl">Your site, live right now</div>
      <div class="url">${esc(demo)}</div>
      <div class="note">Open it on your phone. Nothing to install, nothing to sign.</div>
    </div>

    <h2>What is already built</h2>
    <ul>
      <li>Loads in under two seconds on a phone, on mobile data</li>
      <li>Tap-to-call and tap-to-WhatsApp on every screen</li>
      <li>Enquiries land straight in your inbox and your WhatsApp</li>
      <li>Built so Google can actually read it. Real text, not photos of text</li>
      <li>Your Google Business Profile claimed and set up properly</li>
    </ul>
  </div>

  <div class="foot"><span>Aruba Web Studio</span><span>${esc(name)}</span></div>
</div>

<div class="page">
  <div class="body" style="padding-top:6mm">
    <h2>What it costs</h2>
    <p>No agency overhead, no lock-in. You pay for the site, not for an office in Palm Beach.</p>

    <table>
      <tr><th>&nbsp;</th><th>Starter</th><th class="rec">Business</th><th>Pro</th></tr>
      <tr class="price"><td>To build</td><td>$650</td><td>$950</td><td>$1,600</td></tr>
      <tr class="price"><td>Per month</td><td>$35</td><td>$60</td><td>$110</td></tr>
      <tr><td>Pages</td><td>up to 5</td><td>up to 10</td><td>unlimited</td></tr>
      <tr><td>WhatsApp &amp; call buttons</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td></tr>
      <tr><td>Google Business Profile</td><td>&#10003;</td><td>&#10003;</td><td>&#10003;</td></tr>
      <tr><td>Updates included</td><td>1 / month</td><td>3 / month</td><td>unlimited</td></tr>
      <tr><td>Booking system</td><td>&ndash;</td><td>&#10003;</td><td>&#10003;</td></tr>
      <tr><td>Monthly traffic report</td><td>&ndash;</td><td>&#10003;</td><td>&#10003;</td></tr>
      <tr><td>Online payments</td><td>&ndash;</td><td>&ndash;</td><td>&#10003;</td></tr>
    </table>

    <div class="bundle">
      <h3>First year, all in: $995</h3>
      <p style="margin:0">The Starter build plus twelve months of support, as one payment.
      About 7% cheaper than paying monthly, and you do not think about it again until next year.</p>
    </div>

    <h2>What the monthly actually covers</h2>
    <p>Hosting, SSL, backups, security updates, uptime monitoring, and one content change a
    month: a price, a photo, your hours. Bigger jobs are $45/hour, quoted before I start.</p>
    <p>Most websites on this island die because whoever built them disappeared. The monthly is
    what stops that happening to yours.</p>

    <h2>How it works from here</h2>
    <ul>
      <li>Look at the demo. If it is not for you, say so and I delete it. No charge.</li>
      <li>If you like it, fifteen minutes to talk through what to change.</li>
      <li>50% to start, 50% when it goes live. Live in seven days.</li>
      <li>Your domain, your site, your content. You own all of it.</li>
    </ul>

    <div class="sig">
      <svg viewBox="0 0 240 240" width="42" height="42" style="float:right;margin-top:-4mm"><g transform="translate(0.0,0.0) scale(0.31024) translate(-124.7,-124.7)"><path d="M 499 155 L 422 166 L 361 188 L 298 226 L 253 266 L 209 323 L 178 385 L 160 451 L 155 523 L 164 592 L 188 661 L 228 727 L 270 773 L 325 815 L 391 847 L 451 863 L 521 868 L 591 859 L 661 835 L 727 795 L 775 751 L 817 695 L 849 627 L 865 561 L 868 496 L 857 423 L 833 357 L 800 302 L 755 251 L 702 210 L 641 179 L 573 160 Z M 488 178 L 548 179 L 619 195 L 678 222 L 732 261 L 776 308 L 808 358 L 830 410 L 845 487 L 844 548 L 832 606 L 810 661 L 771 721 L 727 766 L 661 810 L 599 834 L 535 845 L 477 844 L 411 830 L 351 804 L 294 764 L 253 722 L 219 672 L 193 612 L 178 534 L 180 469 L 197 399 L 227 337 L 263 289 L 316 241 L 370 209 L 423 189 Z" fill="#FFC06B" fill-rule="evenodd"/><path d="M 286 381 L 282 390 L 325 390 L 326 395 L 311 416 L 271 423 L 258 436 L 307 437 L 310 463 L 322 490 L 415 634 L 433 677 L 433 695 L 354 695 L 354 710 L 606 710 L 606 695 L 542 695 L 393 508 L 387 483 L 395 473 L 435 472 L 480 488 L 511 509 L 514 518 L 563 542 L 548 561 L 756 561 L 741 545 L 700 541 L 678 529 L 633 527 L 593 538 L 558 525 L 557 518 L 806 518 L 794 505 L 742 499 L 732 487 L 719 483 L 720 478 L 775 478 L 754 462 L 667 458 L 658 445 L 549 448 L 539 442 L 539 436 L 738 436 L 721 422 L 649 415 L 640 404 L 610 395 L 611 390 L 661 390 L 648 377 L 601 372 L 585 362 L 548 354 L 549 349 L 613 349 L 593 334 L 524 330 L 519 317 L 508 313 L 415 316 L 374 325 L 334 343 L 330 349 L 364 350 L 359 361 L 342 372 Z M 504 479 L 568 478 L 588 492 L 558 494 L 530 504 Z M 415 444 L 425 436 L 469 436 L 508 445 L 520 455 L 482 469 L 447 454 L 416 449 Z M 336 437 L 377 436 L 378 441 L 352 470 Z M 462 402 L 468 390 L 505 391 L 496 403 Z M 344 414 L 362 390 L 440 391 L 431 403 L 372 403 L 363 415 Z" fill="#0A2F4E" fill-rule="evenodd"/></g></svg>
      <div class="nm">Victor Rosario</div>
      <div style="color:#5B7488;font-size:12.5px;margin-top:.6mm">Aruba Web Studio</div>
      <div class="ct">+297 747 7794 &middot; arubawebstudio.com</div>
    </div>
  </div>
  <div class="foot"><span>Aruba Web Studio</span><span>Prices in USD, valid 30 days</span></div>
</div>
</body></html>`;

if (process.env.DUMP_HTML) { const { writeFileSync } = await import('fs'); writeFileSync(resolve(ROOT,'outreach','_debug.html'), html); }
const outDir = resolve(ROOT, 'outreach', 'proposals');
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, `${slug}-proposal.pdf`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.pdf({ path: out, format: 'A4', printBackground: true,
                 margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();
console.log(`  ${out}`);
