import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, BookOpen, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { enrollInCourse } from "@/lib/lms.functions";

export const Route = createFileRoute("/_authenticated/courses/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Program` }] }),
  component: CourseDetail,
});

function CourseDetail() {
  const { slug } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const enroll = useServerFn(enrollInCourse);

  const { data, isLoading } = useQuery({
    queryKey: ["course", slug, user.id],
    queryFn: async () => {
      const { data: course, error } = await supabase
        .from("courses")
        .select("*, modules(id, position, title, summary, lessons(id, position, title, duration_min))")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      const [{ data: enrollment }, { data: projects }, { data: assessment }] = await Promise.all([
        supabase.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", course.id).maybeSingle(),
        supabase.from("projects").select("position, title, brief_md").eq("course_id", course.id).order("position"),
        supabase.from("final_assessments").select("title, body_md").eq("course_id", course.id).maybeSingle(),
      ]);
      course.modules.sort((a: any, b: any) => a.position - b.position);
      course.modules.forEach((m: any) => m.lessons.sort((a: any, b: any) => a.position - b.position));
      return { course, enrolled: !!enrollment, projects: projects ?? [], assessment };
    },
  });

  const enrollMut = useMutation({
    mutationFn: () => enroll({ data: { courseId: data!.course.id } }),
    onSuccess: () => {
      toast.success("Enrolled! Let's get started.");
      qc.invalidateQueries({ queryKey: ["course", slug] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      const first = data!.course.modules[0]?.lessons[0];
      if (first) navigate({ to: "/learn/$courseSlug/$lessonId", params: { courseSlug: slug, lessonId: first.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <main className="mx-auto max-w-5xl px-6 py-10 space-y-6"><Skeleton className="h-64 rounded-3xl" /><Skeleton className="h-40 rounded-2xl" /></main>;
  }
  const { course, enrolled, projects, assessment } = data;
  const totalLessons = course.modules.reduce((s: number, m: any) => s + m.lessons.length, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-brand p-10 text-white shadow-glow">
        <div className="absolute inset-0 bg-mesh opacity-50 mix-blend-overlay" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="h-3 w-3" /> {course.level} · {course.duration_label}
          </div>
          <h1 className="mt-5 font-display text-5xl md:text-6xl">{course.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/85">{course.subtitle}</p>
          <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {course.modules.length} modules · {totalLessons} lessons</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> Self-paced</span>
          </div>
          <div className="mt-8">
            {enrolled ? (
              <Button asChild size="lg" className="bg-white text-foreground hover:bg-white/90">
                <Link to="/learn/$courseSlug/$lessonId" params={{ courseSlug: slug, lessonId: course.modules[0].lessons[0].id }}>Continue learning <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            ) : (
              <Button size="lg" onClick={() => enrollMut.mutate()} disabled={enrollMut.isPending} className="bg-white text-foreground hover:bg-white/90">
                {enrollMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Enroll for free
              </Button>
            )}
          </div>
        </div>
      </div>

      {course.summary && (
        <section className="mt-12">
          <h2 className="font-display text-3xl">About this program</h2>
          <p className="mt-3 text-muted-foreground">{course.summary}</p>
        </section>
      )}

      <section className="mt-12">
        <h2 className="font-display text-3xl">Curriculum</h2>
        <div className="mt-5 space-y-3">
          {course.modules.map((m: any) => (
            <div key={m.id} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-muted-foreground">Module {m.position}</div>
                  <h3 className="mt-1 font-display text-xl">{m.title}</h3>
                </div>
                <span className="text-xs text-muted-foreground">{m.lessons.length} lessons</span>
              </div>
              {m.summary && <p className="mt-2 text-sm text-muted-foreground">{m.summary}</p>}
              <ul className="mt-4 divide-y divide-border/60">
                {m.lessons.map((l: any) => (
                  <li key={l.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground/40" />
                      <span className="text-sm">{l.title}</span>
                    </div>
                    {l.duration_min && <span className="text-xs text-muted-foreground">{l.duration_min} min</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {projects.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-3xl">Capstone projects</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {projects.map((p: any) => (
              <div key={p.position} className="rounded-2xl border border-border/60 bg-card p-5">
                <div className="text-xs font-mono text-muted-foreground">Project 0{p.position}</div>
                <div className="mt-2 font-display text-lg">{p.title}</div>
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{p.brief_md}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {assessment && (
        <section className="mt-12 rounded-2xl border border-border/60 bg-accent/40 p-6">
          <h2 className="font-display text-2xl">{assessment.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{assessment.body_md}</p>
        </section>
      )}
    </main>
  );
}
