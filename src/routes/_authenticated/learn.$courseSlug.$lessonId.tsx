import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, ArrowLeft, ArrowRight, FileText, ExternalLink, Award } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { markLessonComplete, issueCertificate } from "@/lib/lms.functions";

export const Route = createFileRoute("/_authenticated/learn/$courseSlug/$lessonId")({
  head: () => ({ meta: [{ title: "Lesson — LMS Trainee Program" }] }),
  component: LessonPlayer,
});

function LessonPlayer() {
  const { courseSlug, lessonId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const markFn = useServerFn(markLessonComplete);
  const issueFn = useServerFn(issueCertificate);

  const { data, isLoading } = useQuery({
    queryKey: ["lesson", courseSlug, lessonId, user.id],
    queryFn: async () => {
      const { data: course } = await supabase.from("courses").select("id, slug, title").eq("slug", courseSlug).single();
      const { data: modules } = await supabase
        .from("modules")
        .select("id, position, title, lessons(id, position, title, duration_min)")
        .eq("course_id", course!.id)
        .order("position");
      modules?.forEach((m: any) => m.lessons.sort((a: any, b: any) => a.position - b.position));
      const flat: any[] = [];
      modules?.forEach((m: any) => m.lessons.forEach((l: any) => flat.push({ ...l, module: m })));
      const { data: lesson } = await supabase
        .from("lessons")
        .select("*, resources(id, kind, title, url)")
        .eq("id", lessonId)
        .single();
      const { data: progress } = await supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id);
      const done = new Set((progress ?? []).map((p) => p.lesson_id));
      const idx = flat.findIndex((l) => l.id === lessonId);
      return {
        course,
        modules: modules ?? [],
        lesson,
        done,
        prev: flat[idx - 1],
        next: flat[idx + 1],
        flat,
      };
    },
  });

  const toggleMut = useMutation({
    mutationFn: (completed: boolean) => markFn({ data: { lessonId, completed } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const certMut = useMutation({
    mutationFn: () => issueFn({ data: { courseId: data!.course!.id } }),
    onSuccess: ({ serial }) => navigate({ to: "/certificates/$serial", params: { serial } }),
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data?.lesson) {
    return <main className="mx-auto max-w-7xl px-6 py-10"><Skeleton className="h-96 rounded-2xl" /></main>;
  }

  const isDone = data.done.has(lessonId);
  const allDone = data.flat.every((l) => l.id === lessonId ? isDone : data.done.has(l.id));

  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[320px_1fr]">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <Link to="/courses/$slug" params={{ slug: courseSlug }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to course
        </Link>
        <h2 className="mt-2 font-display text-xl">{data.course?.title}</h2>
        <div className="mt-5 space-y-5">
          {data.modules.map((m: any) => (
            <div key={m.id}>
              <div className="text-xs font-mono uppercase text-muted-foreground">Week {m.position}</div>
              <div className="text-sm font-medium">{m.title}</div>
              <ul className="mt-2 space-y-0.5">
                {m.lessons.map((l: any) => {
                  const active = l.id === lessonId;
                  const completed = data.done.has(l.id);
                  return (
                    <li key={l.id}>
                      <Link
                        to="/learn/$courseSlug/$lessonId"
                        params={{ courseSlug, lessonId: l.id }}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                      >
                        {completed ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" /> : <Circle className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{l.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      {/* Content */}
      <section>
        <div className="text-xs font-mono text-muted-foreground">Lesson</div>
        <h1 className="mt-1 font-display text-4xl md:text-5xl">{data.lesson.title}</h1>

        {data.lesson.video_url ? (
          <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-border/60 bg-black shadow-lg">
            <iframe src={data.lesson.video_url} className="h-full w-full" allow="encrypted-media; fullscreen" />
          </div>
        ) : (
          <div className="mt-6 grid aspect-video place-items-center rounded-2xl border border-dashed border-border bg-card text-sm text-muted-foreground">
            Video coming soon
          </div>
        )}

        {data.lesson.objectives && (
          <section className="mt-8 rounded-2xl border border-border/60 bg-accent/30 p-5">
            <div className="text-xs font-medium uppercase text-primary">Objectives</div>
            <p className="mt-2 text-sm whitespace-pre-line">{data.lesson.objectives}</p>
          </section>
        )}

        {data.lesson.content_md && (
          <section className="mt-8">
            <div className="prose prose-slate max-w-none text-foreground/90 whitespace-pre-line">{data.lesson.content_md}</div>
          </section>
        )}

        {data.lesson.assignment_md && (
          <section className="mt-8 rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="font-display text-xl">Assignment</h3>
            <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{data.lesson.assignment_md}</p>
          </section>
        )}

        {data.lesson.resources && data.lesson.resources.length > 0 && (
          <section className="mt-8">
            <h3 className="font-display text-xl">Resources</h3>
            <div className="mt-3 space-y-2">
              {data.lesson.resources.map((r: any) => (
                <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 text-sm transition hover:shadow-sm">
                  <span className="inline-flex items-center gap-2">
                    {r.kind === "pdf" ? <FileText className="h-4 w-4 text-primary" /> : <ExternalLink className="h-4 w-4 text-primary" />}
                    {r.title}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Footer actions */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <Button variant="outline" onClick={() => toggleMut.mutate(!isDone)} disabled={toggleMut.isPending}>
            {isDone ? <><CheckCircle2 className="h-4 w-4 text-primary" /> Completed</> : "Mark as complete"}
          </Button>
          <div className="flex gap-2">
            {data.prev && (
              <Button asChild variant="ghost">
                <Link to="/learn/$courseSlug/$lessonId" params={{ courseSlug, lessonId: data.prev.id }}><ArrowLeft className="h-4 w-4" /> Previous</Link>
              </Button>
            )}
            {data.next ? (
              <Button asChild className="bg-gradient-brand text-white">
                <Link to="/learn/$courseSlug/$lessonId" params={{ courseSlug, lessonId: data.next.id }}>Next lesson <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            ) : allDone ? (
              <Button onClick={() => certMut.mutate()} disabled={certMut.isPending} className="bg-gradient-brand text-white">
                <Award className="h-4 w-4" /> Claim certificate
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
