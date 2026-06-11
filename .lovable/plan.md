
# Premium LMS — Build Plan

## 1. Design directions first

Before writing app code, generate 3 rendered design directions inspired by Apple / Notion / Linear / Stripe / Framer, varying composition, density, and motion register while sharing a premium typographic system. Each prototype renders a signed-in student dashboard + a course-detail/lesson-player snapshot so the picks are meaningful. You pick one; the whole app is built in that language (tokens copied verbatim into `src/styles.css`).

## 2. Backend: Lovable Cloud (Supabase under the hood)

Enable Lovable Cloud. Migrate-friendly later — when you self-host on your VPS, point env vars to your own Supabase instance and SMTP without code changes.

**Schema (RLS enabled, `has_role` pattern for admin):**

```text
profiles(id PK→auth.users, full_name, avatar_url, headline)
user_roles(user_id, role: 'admin'|'student')         -- privilege separation
courses(id, slug, title, subtitle, summary, thumbnail_url, level, duration_label, is_published, created_at)
modules(id, course_id, position, title, summary)     -- "weeks"
lessons(id, module_id, position, title, objectives,
        content_md, video_url, duration_min,
        assignment_md, quiz_json)
resources(id, lesson_id, kind: 'pdf'|'link', title, url)
enrollments(id, user_id, course_id, enrolled_at, UNIQUE(user_id, course_id))
lesson_progress(user_id, lesson_id, completed_at, PK(user_id,lesson_id))
certificates(id, user_id, course_id, issued_at, serial)
projects(id, course_id, position, title, brief_md)   -- 3 capstones
final_assessments(id, course_id, title, body_md)
```

Grants + RLS: students read published courses and their own enrollments/progress/certificates; admins do everything via `has_role(auth.uid(),'admin')`.

## 3. Auth

- Email + password signup, login, logout, forgot-password, `/reset-password` page, email verification (Lovable's built-in SMTP now; switch to your Hostinger SMTP via Supabase Auth settings when self-hosting).
- Profile page (name, avatar upload to Storage bucket `avatars`).
- Protected routes under `src/routes/_authenticated/` (integration-managed gate).
- Admin gate: nested `_authenticated/_admin/` checking `has_role`.

## 4. Routes (TanStack Start, file-based)

```text
/                              marketing landing
/auth                          login/signup tabs
/reset-password                set-new-password
/_authenticated/
  dashboard                    welcome, continue learning, enrolled, certs
  courses                      browse + search + filter
  courses/$slug                course detail, enroll CTA
  learn/$courseSlug/$lessonId  lesson player (video, content, resources, prev/next, mark complete)
  certificates/$serial         premium printable cert
  profile                      profile + account
  _admin/
    index                      admin home
    courses                    list + create
    courses/$id                edit (modules, lessons, resources, projects, assessment)
    students                   list + enrollments + progress
```

Every shareable public route gets unique `head()` metadata.

## 5. Student experience

- **Dashboard:** greeting, "Continue learning" card (resumes last lesson), enrolled-courses grid with progress bars, certificates row, profile snippet.
- **Course browse:** elegant cards, search, filter by level/duration, empty states.
- **Course detail:** hero, syllabus by weeks → days, enroll button, instructor block placeholder.
- **Lesson player:** sticky course outline, embedded video, objectives, content, PDF/resource downloads, prev/next, mark-complete button persisting to `lesson_progress`.
- **Progress:** percent-complete derived from `lesson_progress / lessons`; resume = last completed +1.
- **Certificate:** premium print-ready page (A4 landscape, gradient border, serif display type, signature block, QR placeholder). Browser print-to-PDF works; later we can add server-side PDF generation.

## 6. Admin panel (minimal but real)

CRUD for courses, modules, lessons, resources, projects, final assessment. Lists for students + enrollments + per-course progress analytics (avg %, completion count). Uploads stored in Storage buckets `course-thumbnails` (public) and `course-files` (private + signed URLs). Video uploads handled via URL field initially (YouTube/Vimeo/MP4 URL) — note for later: direct video hosting once VPS storage is in place.

## 7. Seed: Data Analytics — 1 Month Remote Training

Migration seeds the full structure:
- 4 modules ("Week 1" … "Week 4"), 5 lessons each = 20 lessons with realistic titles (Intro to Analytics, Excel foundations, SQL basics, Python for data, Pandas, viz with Matplotlib/Seaborn, statistics, dashboards in Power BI/Tableau, storytelling, etc.)
- Each lesson: title, objectives, content placeholder, assignment placeholder, quiz placeholder (JSON), 1 PDF resource stub.
- 3 capstone projects + 1 final assessment + certificate eligibility rule (all lessons complete + final assessment marked done).

## 8. Future WordPress / Tutor LMS migration

Schema mirrors Tutor's hierarchy (Course → Topic/Module → Lesson + Attachments + Quiz). We'll add a `legacy_id` column on `courses`, `modules`, `lessons` so a future import script (CSV or WP REST API) maps cleanly. Documented in `MIGRATION.md`.

## 9. Out of scope for first build (call out explicitly)

- Real PDF generation (browser print works; server-side later).
- Quiz scoring engine (data model is in place; UI placeholder).
- Payments / paid enrollments.
- Direct video hosting (URL field for now).
- Discussion/forum, notifications.

## Technical details

- Stack: TanStack Start + React + Tailwind v4 + shadcn + Lovable Cloud (Supabase).
- Data access: `createServerFn` with `requireSupabaseAuth` for student reads/writes; `supabaseAdmin` (loaded inside handler) for admin mutations after `has_role` check.
- Read shape: `queryClient.ensureQueryData` in loaders + `useSuspenseQuery` in components.
- Storage buckets: `avatars` (public), `course-thumbnails` (public), `course-files` (private, signed URLs).
- Animations: Tailwind keyframes + Motion for hero/dashboard reveals; restrained, no animation-on-everything.
- SEO: per-route `head()`, leaf `og:image` on landing + course detail.

## Build sequence

1. Enable Lovable Cloud.
2. Generate 3 design directions → you pick.
3. Migrations: schema, RLS, grants, `has_role`, seed Data Analytics course.
4. Auth scaffolding (signup/login/reset/verify/profile) in chosen design.
5. Student shell: dashboard, browse, course detail, lesson player, progress, certificate.
6. Admin shell: courses/modules/lessons CRUD, students view, basic analytics.
7. Polish pass: empty states, loading skeletons, error boundaries, responsive QA on mobile/tablet/desktop.

Reply **approve** to start with step 1 (Cloud + design directions).
