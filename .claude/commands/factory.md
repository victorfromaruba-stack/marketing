---
description: The machine. One prospect in, a finished QA-passed demo and a drafted email out.
---

Run the full production line for: **$ARGUMENTS**

You are the foreman. Invoke each subagent in order, check its output before moving on, and
**stop the line the moment a gate fails.** Do not work around a gate. Do not skip a step because
the previous one looked fine.

Read `memory/playbook.md` first. If it is empty, say so and note you are working from reasoned
hypotheses, not evidence.

---

## The line

**1 · analyst** → `intake/$ARGUMENTS.json`
Research them properly. Fill the identity block from their real photos, not defaults. Find the
hook — the specific, verifiable thing they are losing.
*Gate:* if you cannot find an owner name or a real hook, **stop** and tell Victor what is missing.

**2 · assets**
```bash
python3 prospector/fetch_assets.py $ARGUMENTS --place-id <id>
python3 prospector/fetch_assets.py $ARGUMENTS --from-site <url>    # if they have one
```
*Gate:* `logo: MISSING` **stops the line.** A demo without their own logo reads as a template
and burns the prospect. Tell Victor where to find it — Facebook profile picture, signage, van.

**3 · art-director** → `build/decisions/$ARGUMENTS.md`
Palette traced to their material, type justified by their signage, and the signature moment
named in one sentence.
*Gate:* no named signature moment = not finished. Send it back.

**4 · copywriter** → `build/copy/$ARGUMENTS.md`
Every string, in voice. Under-80-word outreach email.
*Gate:* any claim that does not trace to the intake JSON = **stop**.

**5 · engineer** → `sites/$ARGUMENTS/index.html`
Build to the decisions and the copy. Their logo in nav and footer, their photos only, stillness,
click-to-call and WhatsApp above the fold, working Formspree action, LocalBusiness JSON-LD.
If the brief cannot be built as written, **say so and stop** — do not silently redesign.

**6 · inspector**
```bash
node qa/check.mjs $ARGUMENTS --open
```
Then the manual pass — look at the mobile screenshot, run the competitor test, the line-up test,
the truth audit.
*Gate:* **BLOCKED** stops the line. Fix and re-run. Never "pass with minor issues."

**7 · guard**
Secrets, third-party scripts, hotlinked assets, leaked build paths, headers, dependencies.
*Gate:* **BLOCKED** stops the line, including when Victor is in a hurry.

**8 · deploy**
```bash
./deploy/deploy.sh $ARGUMENTS
```
Then write the live URL into `intake/$ARGUMENTS.json` → `build.demo_url`, and set
`build.qa_passed` to true.

**9 · closer** → the proposal and the email
```bash
node outreach/make_proposal.mjs $ARGUMENTS
python3 outreach/make_email.py $ARGUMENTS
```
Improve the generated email — the first line must be specific to this business.

**10 · queue it. Do not send.**
```bash
python3 office/build_office.py
```
It now appears in Victor's approval tray. **Sending is his call, every time.**

---

## Report back — short

```
<Business name>
  demo      <live url>
  design    <the signature moment, one sentence>
  hook      <what they are losing, one sentence>
  QA        <passes/failures>
  omitted   <sections dropped for lack of real information>
  email     <subject line> · <word count> words
  STATUS    queued for your approval
```

If the line stopped, say which step, why, and the one thing needed to restart it. Nothing else.
