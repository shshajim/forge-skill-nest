# LearnForge — Full-Stack LMS (revised with admin, emails, certificates, coupons)

A complete LMS with student/instructor/admin flows, Stripe checkout with coupons, app emails, and PDF certificates. Built on this project's **TanStack Start + React + Tailwind v4** stack using **Lovable Cloud** (Supabase) and **Lovable's built-in Stripe Payments**.

## Stack adaptations from your spec
- Routing → TanStack file-based routes under `src/routes/` (URLs unchanged).
- Backend → Lovable Cloud (auto-wired, no env paste).
- Payments → Lovable's built-in Stripe Payments (no Stripe key paste needed; test mode immediately, coupons via Stripe Promotion Codes).
- Emails → Lovable Emails (built-in, branded subdomain, queue + retries). Resend is only used if you specifically want to keep that provider; the built-in path is the default and equivalent.
- "React Router / Express endpoints" → TanStack server functions + server routes under `src/routes/api/`.

## Roles & gating
Roles in a separate `user_roles` table with `app_role` enum (`student | instructor | admin`) and `has_role()` SECURITY DEFINER function. No role on profiles.
- `_authenticated/` subtree → must be signed in.
- `/instructor/**` → also requires `has_role('instructor')` (server-side check + UI gate).
- `/admin` → requires `has_role('admin')`.

## Routes
| URL | Notes |
|---|---|
| `/` | Hero, featured courses, categories, testimonials |
| `/courses` | Search + sidebar filters + sort |
| `/courses/$slug` | Detail, curriculum, reviews, sticky enroll sidebar |
| `/checkout/$courseId` | Coupon input + Stripe checkout / free enroll |
| `/payment/success` | Verifies session, ensures enrollment, sends purchase email |
| `/auth` | Login + signup tabs, Google OAuth via `lovable.auth.signInWithOAuth` |
| `/_authenticated/dashboard` | Stats, my courses, wishlist, certificates (with Download buttons) |
| `/_authenticated/learn/$courseId/$lessonId` | Player + notes + completion |
| `/_authenticated/instructor` | Revenue chart, courses table, submit-for-review |
| `/_authenticated/instructor/create` | 5-step wizard, "Submit for review" on publish |
| `/_authenticated/admin` | Admin dashboard (pending courses, users, stats) |
| 404 | Root `notFoundComponent` |

`sitemap.xml` + `robots.txt` for public routes.

## Database (one migration)
Tables exactly per your spec, plus:
- `courses.status` enum: `draft | pending_review | published | rejected` (+ `review_note`, `reviewed_by`, `reviewed_at`).
- `profiles.is_banned boolean default false`.
- `user_roles` + `app_role` enum + `has_role()`.
- `certificates` (auto-issued at 100% via trigger).
- Auto-create profile + default `student` role on signup.

RLS:
- `courses` public SELECT **only where `status='published'`**; instructor sees own; admin sees all.
- `sections`/`lessons`: public SELECT only for published-course parents; preview lessons always visible.
- `enrollments`, `lesson_progress`, `wishlist`, `certificates`: user sees/writes only own; admin read-all.
- `reviews`: public read, authenticated user writes own.
- `user_roles`: read-self + admin manage.
- Grants per public-schema rule.
- Trigger on `lesson_progress` insert: when user's completion of course = 100%, insert into `certificates` (if not exists) and enqueue "certificate ready" email.

Seeds 6 courses (your exact spec) with sections + lessons, status='published', so the catalog works instantly.

## Payments + coupons
- `payments--recommend_payment_provider` → `payments--enable_stripe_payments` → `batch_create_product` for the 6 paid courses + a free product reference.
- Server fn `validatePromoCode({ code, courseId })`: calls Stripe API `promotionCodes.list({ code, active: true })`, returns `{ valid, discountedAmount, promotionCodeId }`.
- Server fn `createCheckoutSession({ courseId, promotionCodeId? })`: creates Checkout Session with `discounts: [{ promotion_code }]` when provided; success_url `/payment/success?session_id={CHECKOUT_SESSION_ID}`.
- Free courses → `enrollFree` server fn (no Stripe).
- Webhook `src/routes/api/public/webhooks/stripe.ts`: verify signature, on `checkout.session.completed` insert enrollment, enqueue purchase email.
- `/payment/success` loader also reconciles enrollment (in case webhook is delayed).

## Emails (Lovable Emails — default)
Templates in `src/lib/email-templates/`:
1. `welcome.tsx` — sent on signup (triggered from auth state listener via server fn the first time `profiles.welcomed_at` is null, or via Supabase auth hook).
2. `purchase-confirmation.tsx` — `{courseName, accessUrl, amount}`, triggered by webhook + success page.
3. `certificate-ready.tsx` — `{courseName, certificateUrl}`, triggered by certificate trigger.

Send helper at `src/lib/email/send.ts` posts to `/lovable/email/transactional/send` with idempotency keys (`welcome-{userId}`, `purchase-{sessionId}`, `cert-{certId}`).

Resend alternative: if you reply that you specifically want Resend, I'll wire `RESEND_API_KEY` via the Resend connector instead — same template content, different transport. I'll default to Lovable Emails because it's zero-config and doesn't need a third-party account.

## Certificates (PDF)
- Trigger inserts row in `certificates` at 100% complete.
- Dashboard "Certificates" section lists them; each has a **Download Certificate** button.
- `src/components/CertificatePDF.ts` uses **jsPDF** (browser-side, no server cost) to render an A4 landscape certificate: LearnForge wordmark, gold border, "Certificate of Completion", student full name (script font), course title, instructor name, completion date, certificate ID, signature line. Triggered onClick — no extra route needed.

## Admin dashboard (`/admin`)
- **Stats row**: Total Revenue (sum from `enrollments` × course price), Total Students (distinct user_ids with student role), Total Courses (published), Total Instructors. Server fn `getAdminStats`.
- **Pending Courses table**: courses where `status='pending_review'`. Approve → `status='published'`. Reject → modal for note → `status='rejected'`, `review_note=...`. Both write `reviewed_by`, `reviewed_at` and enqueue an email to the instructor (bonus, branded template).
- **Users table**: server fn returns profiles + role + enrollment count; search by name/email; role badge; **Ban** toggle sets `profiles.is_banned=true` (sign-in/enrollment guards check it).
- All admin actions through server fns gated by `has_role('admin')`.

## Design
Dark-by-default navy theme: `--background:#0f172a`, `--primary:#3b82f6`, `--success:#10b981`, white text, gold for certificate accents. Light-mode toggle in navbar. Glass-morphism navbar (backdrop-blur), hover-scale course cards with gradient thumbnails per the 6 seed courses, skeleton loaders, sonner toasts, empty states. Tokens in `src/styles.css`; no hardcoded color classes in components.

## Build order (multi-turn)
1. Enable Lovable Cloud → enable Stripe Payments → create 6 Stripe products.
2. Migration: enums, tables (incl. `status`, `is_banned`), `user_roles`, `has_role`, RLS, grants, profile + role trigger, 100%-complete certificate trigger, seed 6 courses.
3. Design tokens + shared shell (Navbar, Footer, Theme, Toaster, `_authenticated` already managed).
4. Public pages: Home, Courses, Course detail.
5. Auth page + Google OAuth via lovable broker.
6. Checkout with coupon validate/apply + free enroll + Stripe server fns + webhook + success page.
7. Student dashboard, course player, progress, wishlist, notes, certificate download (jsPDF).
8. Instructor dashboard + 5-step wizard with "Submit for review".
9. Admin dashboard (pending courses, users, stats).
10. Email infra setup + 3 templates + triggers (welcome, purchase, certificate, optional review-decision).
11. sitemap.xml + robots.txt.

## One question before I start
**Email provider:** OK to use **Lovable Emails** (zero-config, branded subdomain, queue/retries) — or do you specifically want **Resend** even though it requires the API key paste? Defaulting to Lovable Emails unless you say otherwise.