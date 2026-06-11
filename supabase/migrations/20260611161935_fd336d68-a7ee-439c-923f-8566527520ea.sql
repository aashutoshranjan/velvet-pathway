
-- ============== ROLES ==============
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  headline TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by all authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============== COURSES ==============
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  summary TEXT,
  thumbnail_url TEXT,
  level TEXT,
  duration_label TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  legacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read published courses" ON public.courses
  FOR SELECT USING (is_published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage courses" ON public.courses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============== MODULES ==============
CREATE TABLE public.modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  position INT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  legacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, position)
);
GRANT SELECT ON public.modules TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read modules of readable courses" ON public.modules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.is_published OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Admins manage modules" ON public.modules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============== LESSONS ==============
CREATE TABLE public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  position INT NOT NULL,
  title TEXT NOT NULL,
  objectives TEXT,
  content_md TEXT,
  video_url TEXT,
  duration_min INT,
  assignment_md TEXT,
  quiz_json JSONB,
  legacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_id, position)
);
GRANT SELECT ON public.lessons TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read lessons of readable courses" ON public.lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = module_id AND (c.is_published OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY "Admins manage lessons" ON public.lessons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============== RESOURCES ==============
CREATE TABLE public.resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'pdf',
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.resources TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read resources" ON public.resources FOR SELECT USING (true);
CREATE POLICY "Admins manage resources" ON public.resources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============== ENROLLMENTS ==============
CREATE TABLE public.enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);
GRANT SELECT, INSERT, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own enrollments" ON public.enrollments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own enrollments" ON public.enrollments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own enrollments" ON public.enrollments
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============== LESSON PROGRESS ==============
CREATE TABLE public.lesson_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, lesson_id)
);
GRANT SELECT, INSERT, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own progress" ON public.lesson_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own progress" ON public.lesson_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own progress" ON public.lesson_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============== CERTIFICATES ==============
CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  serial TEXT NOT NULL UNIQUE DEFAULT ('CERT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);
GRANT SELECT, INSERT ON public.certificates TO authenticated;
GRANT SELECT ON public.certificates TO anon;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can verify certificate by serial" ON public.certificates
  FOR SELECT USING (true);
CREATE POLICY "Users insert own certificate" ON public.certificates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============== PROJECTS & FINAL ASSESSMENT ==============
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  position INT NOT NULL,
  title TEXT NOT NULL,
  brief_md TEXT,
  UNIQUE(course_id, position)
);
GRANT SELECT ON public.projects TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Admins manage projects" ON public.projects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.final_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL UNIQUE REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_md TEXT
);
GRANT SELECT ON public.final_assessments TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.final_assessments TO authenticated;
GRANT ALL ON public.final_assessments TO service_role;
ALTER TABLE public.final_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read final assessments" ON public.final_assessments FOR SELECT USING (true);
CREATE POLICY "Admins manage final assessments" ON public.final_assessments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============== updated_at trigger ==============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== SEED ==============
DO $$
DECLARE
  v_course UUID;
  v_w1 UUID; v_w2 UUID; v_w3 UUID; v_w4 UUID;
BEGIN
  INSERT INTO public.courses (slug, title, subtitle, summary, level, duration_label, is_published)
  VALUES (
    'data-analytics-1-month',
    'Data Analytics — 1 Month Remote Training Program',
    'From zero to job-ready analyst in four focused weeks.',
    'A premium remote training program covering Excel, SQL, Python, statistics, visualization, and storytelling. Includes 3 real-world capstone projects, a final assessment, and an industry-recognized certificate.',
    'Beginner to Intermediate',
    '4 weeks · ~20 hours',
    true
  ) RETURNING id INTO v_course;

  INSERT INTO public.modules (course_id, position, title, summary) VALUES
    (v_course, 1, 'Week 1 — Analytics Foundations', 'The analytics mindset, spreadsheet mastery, and clean data.') RETURNING id INTO v_w1;
  INSERT INTO public.modules (course_id, position, title, summary) VALUES
    (v_course, 2, 'Week 2 — SQL & Databases', 'Query relational data with confidence.') RETURNING id INTO v_w2;
  INSERT INTO public.modules (course_id, position, title, summary) VALUES
    (v_course, 3, 'Week 3 — Python & Statistics for Analysts', 'Pandas, NumPy and core statistical thinking.') RETURNING id INTO v_w3;
  INSERT INTO public.modules (course_id, position, title, summary) VALUES
    (v_course, 4, 'Week 4 — Visualization & Storytelling', 'Dashboards, narrative, and stakeholder communication.') RETURNING id INTO v_w4;

  INSERT INTO public.lessons (module_id, position, title, objectives, content_md, assignment_md, quiz_json, duration_min) VALUES
  (v_w1, 1, 'Day 1 — What an Analyst Actually Does', E'Understand the analyst role.\nMap the analytics workflow end-to-end.', 'Lesson content placeholder.', 'Write a 200-word summary of an analyst job description you find appealing.', '{"questions":[]}'::jsonb, 45),
  (v_w1, 2, 'Day 2 — Spreadsheets, Reframed', E'Master tables, ranges, and formulas.\nUse VLOOKUP / XLOOKUP and INDEX-MATCH.', 'Lesson content placeholder.', 'Clean and reshape the provided sales workbook.', '{"questions":[]}'::jsonb, 50),
  (v_w1, 3, 'Day 3 — Pivot Tables & Conditional Logic', E'Build pivots for fast aggregation.\nApply IF, IFS, and SUMIFS at scale.', 'Lesson content placeholder.', 'Produce three pivot summaries from the retail dataset.', '{"questions":[]}'::jsonb, 50),
  (v_w1, 4, 'Day 4 — Data Cleaning Principles', E'Detect missing values and outliers.\nApply tidy data conventions.', 'Lesson content placeholder.', 'Clean the messy CSV and document each step.', '{"questions":[]}'::jsonb, 55),
  (v_w1, 5, 'Day 5 — Your First Mini Dashboard', E'Wireframe a dashboard layout.\nShip a one-pager in Google Sheets.', 'Lesson content placeholder.', 'Submit a one-page weekly KPI dashboard.', '{"questions":[]}'::jsonb, 60),
  (v_w2, 1, 'Day 6 — Relational Data & SELECT', E'Read a schema diagram.\nWrite SELECT with WHERE and ORDER BY.', 'Lesson content placeholder.', 'Answer 8 query prompts on the sample DB.', '{"questions":[]}'::jsonb, 45),
  (v_w2, 2, 'Day 7 — JOINs in Depth', E'INNER, LEFT, RIGHT, FULL.\nResolve many-to-many through bridge tables.', 'Lesson content placeholder.', 'Reproduce a sales-by-region report using joins.', '{"questions":[]}'::jsonb, 55),
  (v_w2, 3, 'Day 8 — GROUP BY, HAVING & Aggregation', E'Aggregate with SUM, AVG, COUNT.\nFilter groups with HAVING.', 'Lesson content placeholder.', 'Build a cohort-style monthly aggregation.', '{"questions":[]}'::jsonb, 50),
  (v_w2, 4, 'Day 9 — Subqueries & CTEs', E'Refactor nested queries into CTEs.\nUse EXISTS and IN intentionally.', 'Lesson content placeholder.', 'Rewrite three nested queries as readable CTEs.', '{"questions":[]}'::jsonb, 55),
  (v_w2, 5, 'Day 10 — Window Functions', E'ROW_NUMBER, RANK, LAG, LEAD.\nCompute rolling averages and running totals.', 'Lesson content placeholder.', 'Compute a 7-day rolling revenue average.', '{"questions":[]}'::jsonb, 60),
  (v_w3, 1, 'Day 11 — Python for Analysts: Setup', E'Set up a clean Python environment.\nNavigate Jupyter notebooks.', 'Lesson content placeholder.', 'Submit a working notebook with imports.', '{"questions":[]}'::jsonb, 40),
  (v_w3, 2, 'Day 12 — Pandas Essentials', E'Load CSVs into DataFrames.\nSelect, filter, and transform columns.', 'Lesson content placeholder.', 'Replicate three Excel analyses in pandas.', '{"questions":[]}'::jsonb, 60),
  (v_w3, 3, 'Day 13 — Cleaning & Merging in Pandas', E'Handle missing values.\nMerge and concatenate frames.', 'Lesson content placeholder.', 'Merge three CSVs into one analysis-ready frame.', '{"questions":[]}'::jsonb, 60),
  (v_w3, 4, 'Day 14 — Descriptive Statistics', E'Mean, median, variance, distributions.\nQuantify spread and skew.', 'Lesson content placeholder.', 'Produce a one-page statistical profile.', '{"questions":[]}'::jsonb, 55),
  (v_w3, 5, 'Day 15 — A/B Testing Fundamentals', E'Form a hypothesis.\nInterpret p-values and confidence intervals.', 'Lesson content placeholder.', 'Decide the winner of a sample A/B test.', '{"questions":[]}'::jsonb, 60),
  (v_w4, 1, 'Day 16 — Charts that Earn Trust', E'Pick the right chart for the question.\nAvoid the most common visual lies.', 'Lesson content placeholder.', 'Critique five real-world charts.', '{"questions":[]}'::jsonb, 45),
  (v_w4, 2, 'Day 17 — Dashboarding in Tableau / Power BI', E'Build interactive views.\nApply filters and parameters.', 'Lesson content placeholder.', 'Recreate the provided executive dashboard.', '{"questions":[]}'::jsonb, 60),
  (v_w4, 3, 'Day 18 — Telling the Story', E'Structure an analytical narrative.\nLead with the insight, support with data.', 'Lesson content placeholder.', 'Write a 1-page narrative for your dashboard.', '{"questions":[]}'::jsonb, 50),
  (v_w4, 4, 'Day 19 — Stakeholder Communication', E'Run a 15-minute review meeting.\nHandle pushback gracefully.', 'Lesson content placeholder.', 'Record a 5-minute insight walkthrough.', '{"questions":[]}'::jsonb, 50),
  (v_w4, 5, 'Day 20 — Putting It All Together', E'Tie the four weeks into one workflow.\nPrepare for the capstone projects.', 'Lesson content placeholder.', 'Outline your capstone project plan.', '{"questions":[]}'::jsonb, 60);

  INSERT INTO public.projects (course_id, position, title, brief_md) VALUES
  (v_course, 1, 'E-commerce Funnel Analysis', 'Analyze a real e-commerce dataset and identify the three highest-impact funnel drop-offs with supporting evidence.'),
  (v_course, 2, 'Subscription Retention Deep-Dive', 'Use SQL and pandas to compute cohort retention for a SaaS dataset and recommend one intervention.'),
  (v_course, 3, 'Executive KPI Dashboard', 'Design and ship an interactive dashboard for a fictional CEO covering revenue, retention, and growth.');

  INSERT INTO public.final_assessments (course_id, title, body_md) VALUES
  (v_course, 'Final Assessment — Data Analyst Readiness', 'A timed mixed-format assessment covering SQL, pandas, statistics, and visualization. Pass to unlock your certificate.');
END $$;
