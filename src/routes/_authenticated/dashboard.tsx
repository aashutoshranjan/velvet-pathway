import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Award, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LMS Trainee Program" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user.id],
    queryFn: async () => {
      const [profileR, enrollR, certR, progressR] = await Promise.all([
        supabase.from("profiles").select("full_name, headline").eq("id", user.id).maybeSingle(),
        supabase.from("enrollments").select("course_id, enrolled_at, courses(id, slug, title, subtitle, thumbnail_url, duration_label, level)").eq("user_id", user.id),
        supabase.from("certificates").select("serial, issued_at, courses(title, slug)").eq("user_id", user.id),
        supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id),
      ]);
      const enrolls = enrollR.data ?? [];
      // for each course count lessons + done
      const courseIds = enrolls.map((e: any) => e.course_id);
      const lessonsByCourse: Record<string, string[]> = {};
      if (courseIds.length) {
        const { data: ls } = await supabase
          .from("lessons")
          .select("id, modules!inner(course_id)")
          .in("modules.course_id", courseIds);
        for (const l of ls ?? []) {
          const cid = (l as any).modules.course_id;
          (lessonsByCourse[cid] ||= []).push(l.id);
        }
      }
      const doneSet = new Set((progressR.data ?? []).map((p) => p.lesson_id));
      const courses = enrolls.map((e: any) => {
        const all = lessonsByCourse[e.course_id] ?? [];
        const done = all.filter((id) => doneSet.has(id)).length;
        return { ...e, totalLessons: all.length, doneLessons: done, percent: all.length ? Math.round((done / all.length) * 100) : 0 };
      });
      return { profile: profileR.data, courses, certs: certR.data ?? [] };
    },
  });

  const firstName = data?.profile?.full_name?.split(" ")[0] ?? "there";

  const certByCourse = new Set((data?.certs ?? []).map((c: any) => c.courses?.slug));

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Welcome back</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">Hi, {firstName}.</h1>
        </div>
        <Button asChild variant="outline" className="h-10"><Link to="/courses">Browse programs <ArrowRight className="h-4 w-4" /></Link></Button>
      </div>

      {isLoading ? (
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : data!.courses.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Continue learning */}
          <ContinueLearning course={data!.courses.find((c) => c.percent < 100) ?? data!.courses[0]} />

          <section className="mt-14">
            <h2 className="font-display text-2xl">Your programs</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {data!.courses.map((c: any) => {
                const hasCert = certByCourse.has(c.courses.slug);
                return (
                  <Link
                    key={c.course_id}
                    to="/courses/$slug"
                    params={{ slug: c.courses.slug }}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-gradient-brand">
                      <div className="absolute inset-0 bg-mesh opacity-60 mix-blend-overlay" />
                      {hasCert && (
                        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground shadow-sm">
                          <Award className="h-3 w-3" /> Certified
                        </div>
                      )}
                      <div className="absolute bottom-3 left-3 text-[11px] font-mono text-white/90">{c.courses.duration_label}</div>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-display text-lg leading-snug">{c.courses.title}</h3>
                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{c.doneLessons}/{c.totalLessons} lessons</span>
                        <span className="font-medium text-foreground">{c.percent}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-gradient-brand transition-all" style={{ width: `${c.percent}%` }} />
                      </div>
                      <div className="mt-4 inline-flex items-center text-xs font-medium text-primary">
                        {c.percent === 0 ? "Start program" : c.percent === 100 ? "Review program" : "Continue program"} <ArrowRight className="ml-1 h-3 w-3 transition group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {data!.certs.length > 0 && (
            <section className="mt-14">
              <h2 className="font-display text-2xl">Your certificates</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {data!.certs.map((c: any) => (
                  <Link key={c.serial} to="/certificates/$serial" params={{ serial: c.serial }} className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 transition hover:shadow-md">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-brand text-white shadow-sm"><Award className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-base">{c.courses.title}</div>
                      <div className="text-xs font-mono text-muted-foreground">{c.serial}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function ContinueLearning({ course }: { course: any }) {
  const { data: next } = useQuery({
    queryKey: ["next-lesson", course.course_id],
    queryFn: async () => {
      const { data: progress } = await supabase.from("lesson_progress").select("lesson_id");
      const done = new Set((progress ?? []).map((p) => p.lesson_id));
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, title, position, modules!inner(position, course_id)")
        .eq("modules.course_id", course.course_id)
        .order("position");
      const sorted = (lessons ?? []).sort((a: any, b: any) => a.modules.position - b.modules.position || a.position - b.position);
      return sorted.find((l: any) => !done.has(l.id)) ?? sorted[0];
    },
  });

  return (
    <section className="mt-10 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
      <div className="relative grid md:grid-cols-[1fr_1.2fr]">
        <div className="relative hidden bg-gradient-brand md:block">
          <div className="absolute inset-0 bg-mesh opacity-40 mix-blend-overlay" />
          <div className="relative flex h-full flex-col justify-between p-8 text-white">
            <Sparkles className="h-6 w-6" />
            <div>
              <div className="text-xs uppercase tracking-wider text-white/70">Continue learning</div>
              <div className="mt-2 font-display text-3xl">{course.courses.title}</div>
            </div>
          </div>
        </div>
        <div className="p-8">
          <div className="text-xs font-mono text-muted-foreground">Up next</div>
          <h3 className="mt-2 font-display text-3xl">{next?.title ?? "Loading…"}</h3>
          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            {course.doneLessons}/{course.totalLessons} lessons completed
          </div>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-gradient-brand" style={{ width: `${course.percent}%` }} />
          </div>
          {next && (
            <Button asChild size="lg" className="mt-6 bg-gradient-brand text-white">
              <Link to="/learn/$courseSlug/$lessonId" params={{ courseSlug: course.courses.slug, lessonId: next.id }}>
                Resume lesson <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-white">
        <BookOpen className="h-6 w-6" />
      </div>
      <h2 className="mt-6 font-display text-3xl">You're not enrolled yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Browse our programs and enroll to start your training journey.</p>
      <Button asChild className="mt-6 bg-gradient-brand text-white"><Link to="/courses">Browse courses</Link></Button>
    </div>
  );
}
