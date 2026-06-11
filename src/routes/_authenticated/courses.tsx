import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/courses")({
  head: () => ({ meta: [{ title: "Programs — LMS Trainee Program" }] }),
  component: CoursesPage,
});

function CoursesPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, slug, title, subtitle, summary, level, duration_label, thumbnail_url")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (data ?? []).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()) || (c.subtitle ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Explore</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">All programs</h1>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search programs…" className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-12 text-sm text-muted-foreground">No programs match your search.</p>
      ) : (
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} to="/courses/$slug" params={{ slug: c.slug }} className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="relative aspect-[16/9] overflow-hidden bg-gradient-brand">
                <div className="absolute inset-0 bg-mesh opacity-60 mix-blend-overlay" />
                <div className="absolute bottom-3 left-3 text-[11px] font-mono text-white/90">{c.level} · {c.duration_label}</div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-xl leading-tight">{c.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.subtitle}</p>
                <div className="mt-4 inline-flex items-center text-xs font-medium text-primary">View program <span className="ml-1 transition group-hover:translate-x-0.5">→</span></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
