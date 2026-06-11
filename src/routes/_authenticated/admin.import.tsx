import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useServerFn } from "@tanstack/react-query";
import { useServerFn as useStartServerFn } from "@tanstack/react-start";
import { Upload, FileJson, CheckCircle2, AlertCircle, SkipForward, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { importProgram, type ImportLogEntry } from "@/lib/admin-import.functions";

export const Route = createFileRoute("/_authenticated/admin/import")({
  head: () => ({ meta: [{ title: "Import Programs — Admin" }] }),
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userRes.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: ImportPage,
});

type Program = {
  slug: string; title: string; modules?: Array<{ title: string; lessons?: unknown[] }>;
  [k: string]: unknown;
};

function normalizePrograms(raw: unknown): Program[] {
  if (Array.isArray(raw)) return raw as Program[];
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.programs)) return r.programs as Program[];
    if (Array.isArray(r.courses)) return r.courses as Program[];
    if (r.slug && r.title) return [r as Program];
  }
  return [];
}

function ImportPage() {
  const importFn = useStartServerFn(importProgram);
  const [file, setFile] = useState<File | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentLabel, setCurrentLabel] = useState("");
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [summary, setSummary] = useState<{ programs: number; programsSkipped: number; modules: number; modulesSkipped: number; lessons: number; lessonsSkipped: number; errors: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    setFile(f); setParseError(null); setPrograms([]); setLogs([]); setSummary(null); setProgress(0);
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      const list = normalizePrograms(json);
      if (list.length === 0) { setParseError("No programs found in JSON. Expected an array of programs or { programs: [...] }."); return; }
      setPrograms(list);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to parse JSON");
    }
  }

  async function runImport() {
    if (programs.length === 0 || running) return;
    setRunning(true); setLogs([]); setProgress(0);
    const totals = { programs: 0, programsSkipped: 0, modules: 0, modulesSkipped: 0, lessons: 0, lessonsSkipped: 0, errors: 0 };
    for (let i = 0; i < programs.length; i++) {
      const p = programs[i];
      setCurrentLabel(`Importing "${p.title}" (${i + 1}/${programs.length})`);
      try {
        const res = await importFn({ data: { program: p } });
        setLogs((prev) => [...prev, ...res.logs]);
        totals.programs += res.counts.programs;
        totals.programsSkipped += res.counts.programsSkipped;
        totals.modules += res.counts.modules;
        totals.modulesSkipped += res.counts.modulesSkipped;
        totals.lessons += res.counts.lessons;
        totals.lessonsSkipped += res.counts.lessonsSkipped;
        totals.errors += res.logs.filter((l) => l.level === "error").length;
      } catch (e) {
        totals.errors++;
        setLogs((prev) => [...prev, { level: "error", message: `Program "${p.title}": ${e instanceof Error ? e.message : String(e)}` }]);
      }
      setProgress(Math.round(((i + 1) / programs.length) * 100));
    }
    setCurrentLabel("");
    setSummary(totals);
    setRunning(false);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Admin</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl">Import Programs</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Upload a WordPress export JSON file to import programs, modules (weeks), and lessons. Duplicate records are skipped based on program slug, module position, and lesson position.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-border/60 bg-card p-6 shadow-xs">
        <label htmlFor="json-file" className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 px-6 py-12 text-center transition hover:border-primary/40 hover:bg-secondary/40">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary"><Upload className="h-5 w-5" /></div>
          <div>
            <p className="font-medium">{file ? file.name : "Choose a JSON file"}</p>
            <p className="text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(1)} KB` : "Click to browse"}</p>
          </div>
          <input ref={inputRef} id="json-file" type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
        </label>

        {parseError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{parseError}</span>
          </div>
        )}

        {programs.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileJson className="h-4 w-4" />
              <span><strong className="text-foreground">{programs.length}</strong> program{programs.length === 1 ? "" : "s"} detected · {programs.reduce((a, p) => a + (p.modules?.length ?? 0), 0)} module(s) · {programs.reduce((a, p) => a + (p.modules?.reduce((b, m) => b + (m.lessons?.length ?? 0), 0) ?? 0), 0)} lesson(s)</span>
            </div>
            <Button onClick={runImport} disabled={running} className="bg-gradient-brand text-white shadow-sm hover:opacity-90">
              {running ? <><Loader2 className="h-4 w-4 animate-spin" />Importing…</> : "Start import"}
            </Button>
          </div>
        )}

        {(running || progress > 0) && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{currentLabel || (progress === 100 ? "Complete" : "")}</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}
      </div>

      {summary && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Programs" created={summary.programs} skipped={summary.programsSkipped} />
          <SummaryCard label="Modules" created={summary.modules} skipped={summary.modulesSkipped} />
          <SummaryCard label="Lessons" created={summary.lessons} skipped={summary.lessonsSkipped} />
          {summary.errors > 0 && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 sm:col-span-3">
              <p className="text-sm font-medium text-destructive">{summary.errors} error(s) — see log below.</p>
            </div>
          )}
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card shadow-xs">
          <div className="border-b border-border/60 px-5 py-3">
            <h2 className="font-display text-lg">Import log</h2>
          </div>
          <div className="max-h-[480px] overflow-auto p-2 font-mono text-xs">
            {logs.map((l, i) => (
              <div key={i} className="flex items-start gap-2 rounded px-3 py-1.5 hover:bg-secondary/40">
                {l.level === "success" && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                {l.level === "skip" && <SkipForward className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
                {l.level === "error" && <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
                {l.level === "info" && <span className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span className={l.level === "error" ? "text-destructive" : l.level === "skip" ? "text-amber-600 dark:text-amber-400" : ""}>{l.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ label, created, skipped }: { label: string; created: number; skipped: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="font-display text-2xl">{created}</span>
        <span className="text-xs text-muted-foreground">created</span>
        <span className="ml-auto text-xs text-amber-600 dark:text-amber-400">{skipped} skipped</span>
      </div>
    </div>
  );
}
