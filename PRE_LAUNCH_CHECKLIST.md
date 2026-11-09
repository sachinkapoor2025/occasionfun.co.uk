# Pre-launch checklist — OCCASIONFUN LTD

Use this list before making the website public. Items marked **placeholder** are intentionally incomplete in code until verified facts are supplied.

## Company facts still required

- [ ] Exact Companies House registered-office address
- [ ] Approved public business email
- [ ] Approved public business telephone number
- [ ] Confirmed website domain and DNS ownership
- [ ] Name and role of UK business representative (only if publishing)
- [ ] Approved description of UK IT professional role (only if publishing)
- [ ] Approved company logo and brand assets
- [ ] DGV full legal entity name
- [ ] DGV country of registration
- [ ] DGV registered address
- [ ] DGV website/logo (only if approved)
- [ ] Any genuine publishable project examples/references (optional; never invent)

## Placeholder fields in `src/config/company.ts`

- [ ] `registeredOffice`
- [ ] `businessEmail`
- [ ] `businessPhone`
- [ ] `domain`
- [ ] `ukRepresentativeName`
- [ ] `ukRepresentativeRole`
- [ ] `dgvLegalName`
- [ ] `dgvCountry`
- [ ] `dgvRegisteredAddress`
- [ ] `dgvWebsite`
- [ ] `privacyEmail`

After replacement, set `FAIL_ON_PLACEHOLDERS=true` in production CI.

## Legal and policy review

- [ ] Privacy notice reviewed and approved (`/privacy`)
- [ ] Cookie notice reviewed and approved (`/cookies`)
- [ ] Website terms reviewed and approved (`/terms`)
- [ ] Confirm which supplier documents are truly available on request
- [ ] Do not publish auto-generated policy PDFs as legally reviewed
- [ ] Insurance wording/limits only if approved; never publish sensitive policy numbers publicly
- [ ] Modern slavery / environmental / H&S / quality policies only if applicable and approved

## Security and data decisions

- [ ] Confirm actual security controls currently implemented (do not over-claim on `/trust`)
- [ ] Decide enquiry retention and deletion process before collecting real enquiries
- [ ] Configure `CONTACT_WEBHOOK_URL` and verified notification mailbox
- [ ] Confirm whether any analytics provider will be used
- [ ] If analytics is approved, document cookies and keep consent gate in place
- [ ] Confirm international transfer approach before any overseas personal-data access
- [ ] No Cyber Essentials badge or ISO/framework claims unless verified and authorised
- [ ] No public file-upload feature without malware scanning design

## Content integrity checks

- [ ] No invented clients, testimonials, case studies or contract awards
- [ ] No invented staff biographies or certifications
- [ ] DGV described only as technology/delivery partner unless legal relationship says otherwise
- [ ] No implication that all delivery is UK-based
- [ ] No implication that overseas access is automatically acceptable to every buyer
- [ ] Company number `17427098` and legal name consistent site-wide
- [ ] Illustrative deliverables remain labelled as examples

## Technical launch checks

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] Desktop/tablet/mobile review of all routes
- [ ] Keyboard navigation and focus states checked
- [ ] Contact form success/error states checked
- [ ] Sitemap and robots reachable
- [ ] Open Graph metadata reviewed
- [ ] Amplify (or chosen host) staging verified
- [ ] Custom domain, DNS and HTTPS verified
- [ ] Rollback path documented and understood
