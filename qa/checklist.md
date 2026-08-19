# Manual QA — the part the script cannot do

Run `node qa/check.mjs <slug>` first. It must be clean. Then do this by hand, every time.
The script checks mechanics. This checks whether the thing is any good.

## Look at it on a real phone

Open the demo on your actual phone, over mobile data, not wifi.

- [ ] Does the hero make you want to keep scrolling, or does it look like a template?
- [ ] Can you tell what this business does within 3 seconds?
- [ ] Is the primary action (book/call/menu) obvious without scrolling?
- [ ] Tap every button. Do they all do what they say?
- [ ] Does the WhatsApp link open WhatsApp with the right number and a sensible prefilled message?
- [ ] Does the phone link actually dial?

## The WOW bar — all seven present?

- [ ] **Signature moment** — one thing no template would have done, and you can name it in a sentence
- [ ] **Typography commits** — hero headline genuinely huge, negative tracking, one accent word
- [ ] **Stillness** — load it and leave it 5 seconds. Does anything move? It must not.
- [ ] **Texture and depth** — grain overlay, layered scrims, real shadows
- [ ] **Grid broken once** — an offset card, a bleeding image, an asymmetric split
- [ ] **Everything responds** — buttons lift, cards lift, inputs have a coloured focus ring
- [ ] **Detail nobody asked for** — numbered sections, a scroll cue, a custom mark, ::selection colour

Scroll slowly from top to bottom on a real phone:

- [ ] Nothing slides in, fades up, zooms, or shifts position as you scroll
- [ ] Cards in a row sit on the same line — none deliberately offset
- [ ] The header does not resize or change height as you scroll
- [ ] Tapping a nav link lands instantly rather than gliding

## Their assets — the thing that makes it convert

- [ ] **Their logo is in the nav**, legible at that size (no strapline in the compact lockup)
- [ ] Logo repeated in the footer, full lockup with room to breathe
- [ ] Logo transparency preserved — not flattened onto a colour that fights it
- [ ] **Every photo on the page is genuinely theirs.** No stock, none borrowed from a competitor
- [ ] Alt text written after actually opening each image and looking at it
- [ ] Palette matches `identity.colors` — their brand colours, not prettier ones you preferred
- [ ] Any unusable photo (blurry, dark, thumb over the lens) was dropped, not shipped
- [ ] If `img/ATTRIBUTION.txt` exists, those credits are on the page

## Does it look like THEM?

This is the one that decides whether the demo converts.

- [ ] Open their Instagram next to the demo. Do they feel like the same business?
- [ ] Are the colours from *their* material, or did you default to blue-and-white?
- [ ] **Competitor test:** would this design work for a competitor down the road with the logo swapped? **If yes, it is generic — redo it.**
- [ ] **Line-up test:** lay it beside your last two demos. Three different studios, or one template recoloured?
- [ ] **Screenshot test:** would you post the mobile screenshot as portfolio work?
- [ ] Does the copy sound like how the owner talks, or like an agency?

## Truth check — read every word

- [ ] Every price appears in the intake JSON
- [ ] Every opening hour appears in the intake JSON
- [ ] Every testimonial is real, quoted exactly, attributed exactly
- [ ] The phone number is correct — call it
- [ ] The address is correct and the map pin is on the right building
- [ ] The business name is spelled exactly right, including any Papiamento or Dutch spelling
- [ ] Nothing on the page is a guess

## The last question

- [ ] If this were the only work sample anyone ever saw of yours, would you be happy?

If no — it is not done. Do not deploy. Do not email.
