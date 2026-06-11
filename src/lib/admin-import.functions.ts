import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LessonSchema = z.object({
  title: z.string().min(1).max(500),
  content_html: z.string().optional().nullable(),
  content_md: z.string().optional().nullable(),
  position: z.number().int().optional(),
  duration_min: z.number().int().optional().nullable(),
  video_url: z.string().optional().nullable(),
  objectives: z.string().optional().nullable(),
  legacy_id: z.union([z.string(), z.number()]).optional().nullable(),
});

const ModuleSchema = z.object({
  title: z.string().min(1).max(500),
  summary: z.string().optional().nullable(),
  position: z.number().int().optional(),
  legacy_id: z.union([z.string(), z.number()]).optional().nullable(),
  lessons: z.array(LessonSchema).default([]),
});

const ProgramSchema = z.object({
  slug: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  subtitle: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  level: z.string().optional().nullable(),
  duration_label: z.string().optional().nullable(),
  thumbnail_url: z.string().optional().nullable(),
  is_published: z.boolean().optional(),
  legacy_id: z.union([z.string(), z.number()]).optional().nullable(),
  modules: z.array(ModuleSchema).default([]),
});

export type ImportLogEntry = { level: "info" | "success" | "skip" | "error"; message: string };

export const importProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ program: ProgramSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const logs: ImportLogEntry[] = [];
    const counts = { programs: 0, programsSkipped: 0, modules: 0, modulesSkipped: 0, lessons: 0, lessonsSkipped: 0 };
    const p = data.program;

    // Course: upsert by slug, skip if exists
    let courseId: string;
    const { data: existingCourse } = await supabaseAdmin
      .from("courses").select("id").eq("slug", p.slug).maybeSingle();
    if (existingCourse) {
      courseId = existingCourse.id;
      counts.programsSkipped++;
      logs.push({ level: "skip", message: `Program "${p.title}" already exists (slug: ${p.slug})` });
    } else {
      const { data: ins, error } = await supabaseAdmin.from("courses").insert({
        slug: p.slug, title: p.title, subtitle: p.subtitle ?? null, summary: p.summary ?? null,
        level: p.level ?? null, duration_label: p.duration_label ?? null,
        thumbnail_url: p.thumbnail_url ?? null, is_published: p.is_published ?? true,
        legacy_id: p.legacy_id != null ? String(p.legacy_id) : null,
      }).select("id").single();
      if (error || !ins) {
        logs.push({ level: "error", message: `Program "${p.title}": ${error?.message ?? "insert failed"}` });
        return { logs, counts };
      }
      courseId = ins.id;
      counts.programs++;
      logs.push({ level: "success", message: `Program created: ${p.title}` });
    }

    for (let mi = 0; mi < p.modules.length; mi++) {
      const m = p.modules[mi];
      const mPos = m.position ?? mi + 1;
      let moduleId: string;
      const { data: existingMod } = await supabaseAdmin
        .from("modules").select("id").eq("course_id", courseId).eq("position", mPos).maybeSingle();
      if (existingMod) {
        moduleId = existingMod.id;
        counts.modulesSkipped++;
        logs.push({ level: "skip", message: `  Module "${m.title}" (pos ${mPos}) already exists` });
      } else {
        const { data: ins, error } = await supabaseAdmin.from("modules").insert({
          course_id: courseId, title: m.title, summary: m.summary ?? null, position: mPos,
          legacy_id: m.legacy_id != null ? String(m.legacy_id) : null,
        }).select("id").single();
        if (error || !ins) {
          logs.push({ level: "error", message: `  Module "${m.title}": ${error?.message ?? "insert failed"}` });
          continue;
        }
        moduleId = ins.id;
        counts.modules++;
        logs.push({ level: "success", message: `  Module created: ${m.title}` });
      }

      for (let li = 0; li < m.lessons.length; li++) {
        const l = m.lessons[li];
        const lPos = l.position ?? li + 1;
        const { data: existingLes } = await supabaseAdmin
          .from("lessons").select("id").eq("module_id", moduleId).eq("position", lPos).maybeSingle();
        if (existingLes) {
          counts.lessonsSkipped++;
          logs.push({ level: "skip", message: `    Lesson "${l.title}" (pos ${lPos}) already exists` });
          continue;
        }
        const content = l.content_md ?? l.content_html ?? null;
        const { error } = await supabaseAdmin.from("lessons").insert({
          module_id: moduleId, title: l.title, content_md: content, position: lPos,
          duration_min: l.duration_min ?? null, video_url: l.video_url ?? null,
          objectives: l.objectives ?? null,
          legacy_id: l.legacy_id != null ? String(l.legacy_id) : null,
        });
        if (error) {
          logs.push({ level: "error", message: `    Lesson "${l.title}": ${error.message}` });
        } else {
          counts.lessons++;
          logs.push({ level: "success", message: `    Lesson created: ${l.title}` });
        }
      }
    }

    return { logs, counts };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: !!data };
  });
