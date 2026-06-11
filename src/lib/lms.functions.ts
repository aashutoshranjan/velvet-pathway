import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const enrollInCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ courseId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("enrollments")
      .insert({ user_id: userId, course_id: data.courseId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const markLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ lessonId: z.string().uuid(), completed: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.completed) {
      const { error } = await supabase
        .from("lesson_progress")
        .upsert({ user_id: userId, lesson_id: data.lessonId, completed_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("lesson_progress")
        .delete()
        .eq("user_id", userId)
        .eq("lesson_id", data.lessonId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    full_name: z.string().min(1).max(120),
    headline: z.string().max(200).optional().nullable(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: data.full_name, headline: data.headline ?? null })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const issueCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ courseId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // verify all lessons complete
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, modules!inner(course_id)")
      .eq("modules.course_id", data.courseId);
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId);
    const done = new Set((progress ?? []).map((p) => p.lesson_id));
    const all = (lessons ?? []).every((l) => done.has(l.id));
    if (!all) throw new Error("Complete every lesson to claim your certificate.");
    const { data: existing } = await supabase
      .from("certificates")
      .select("serial")
      .eq("user_id", userId)
      .eq("course_id", data.courseId)
      .maybeSingle();
    if (existing) return { serial: existing.serial };
    const serial = `LMS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { error } = await supabase
      .from("certificates")
      .insert({ user_id: userId, course_id: data.courseId, serial });
    if (error) throw new Error(error.message);
    return { serial };
  });
