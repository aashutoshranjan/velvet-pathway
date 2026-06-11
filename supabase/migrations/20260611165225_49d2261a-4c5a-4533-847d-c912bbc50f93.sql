
CREATE OR REPLACE FUNCTION public.is_course_complete(_user_id uuid, _course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l JOIN public.modules m ON m.id = l.module_id
    WHERE m.course_id = _course_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.lessons l JOIN public.modules m ON m.id = l.module_id
    WHERE m.course_id = _course_id
      AND NOT EXISTS (
        SELECT 1 FROM public.lesson_progress lp
        WHERE lp.lesson_id = l.id AND lp.user_id = _user_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_course_outline(_course_slug text)
RETURNS TABLE (module_id uuid, module_position int, module_title text, module_summary text,
               lesson_id uuid, lesson_position int, lesson_title text, lesson_duration_min int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.position, m.title, m.summary, l.id, l.position, l.title, l.duration_min
  FROM public.courses c
  JOIN public.modules m ON m.course_id = c.id
  LEFT JOIN public.lessons l ON l.module_id = m.id
  WHERE c.slug = _course_slug
    AND (c.is_published OR public.has_role(auth.uid(), 'admin'::app_role))
  ORDER BY m.position, l.position;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_course_complete(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_course_complete(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_course_outline(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_course_outline(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can read lessons of readable courses" ON public.lessons;
CREATE POLICY "Enrolled or admin can read lessons" ON public.lessons FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.enrollments e JOIN public.modules m ON m.course_id = e.course_id
    WHERE m.id = lessons.module_id AND e.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anyone can read resources" ON public.resources;
CREATE POLICY "Enrolled or admin can read resources" ON public.resources FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.modules m ON m.course_id = e.course_id
    JOIN public.lessons l ON l.module_id = m.id
    WHERE l.id = resources.lesson_id AND e.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anyone can read projects" ON public.projects;
CREATE POLICY "Enrolled or admin can read projects" ON public.projects FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = projects.course_id AND e.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can read final assessments" ON public.final_assessments;
CREATE POLICY "Enrolled or admin can read final assessments" ON public.final_assessments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = final_assessments.course_id AND e.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users insert own certificate" ON public.certificates;
CREATE POLICY "Users insert own certificate after completion" ON public.certificates FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_course_complete(auth.uid(), course_id));
