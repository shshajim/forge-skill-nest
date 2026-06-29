
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('student', 'instructor', 'admin');
CREATE TYPE public.course_status AS ENUM ('draft', 'pending_review', 'published', 'rejected');
CREATE TYPE public.course_difficulty AS ENUM ('Beginner', 'Intermediate', 'Advanced');
CREATE TYPE public.price_type AS ENUM ('free', 'one_time', 'subscription');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  welcomed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are publicly readable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ AUTO-CREATE PROFILE + DEFAULT ROLE ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role := 'student';
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  IF NEW.raw_user_meta_data->>'role' = 'instructor' THEN
    v_role := 'instructor';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ COURSES ============
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  category TEXT NOT NULL,
  difficulty public.course_difficulty NOT NULL DEFAULT 'Beginner',
  language TEXT NOT NULL DEFAULT 'English',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_type public.price_type NOT NULL DEFAULT 'one_time',
  duration_text TEXT,
  thumbnail_gradient TEXT,
  thumbnail_url TEXT,
  status public.course_status NOT NULL DEFAULT 'draft',
  review_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  instructor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  instructor_name TEXT NOT NULL,
  instructor_avatar_url TEXT,
  instructor_bio TEXT,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  enrollment_count INT NOT NULL DEFAULT 0,
  what_you_learn JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published courses" ON public.courses FOR SELECT USING (status = 'published');
CREATE POLICY "Instructor reads own courses" ON public.courses FOR SELECT USING (auth.uid() = instructor_id);
CREATE POLICY "Admin reads all courses" ON public.courses FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructor creates courses" ON public.courses FOR INSERT
  WITH CHECK (auth.uid() = instructor_id AND public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor updates own courses" ON public.courses FOR UPDATE
  USING (auth.uid() = instructor_id) WITH CHECK (auth.uid() = instructor_id);
CREATE POLICY "Admin updates any course" ON public.courses FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructor deletes own draft" ON public.courses FOR DELETE
  USING (auth.uid() = instructor_id AND status IN ('draft','rejected'));

-- ============ SECTIONS ============
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sections TO authenticated;
GRANT ALL ON public.sections TO service_role;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sections readable for published" ON public.sections FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.status = 'published' OR c.instructor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Instructor manages own sections" ON public.sections FOR ALL
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid()));

-- ============ LESSONS ============
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  video_url TEXT,
  duration_minutes INT NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  is_preview BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT ON public.lessons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lessons readable for published" ON public.lessons FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sections s JOIN public.courses c ON c.id = s.course_id
    WHERE s.id = section_id AND (c.status='published' OR c.instructor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ));
CREATE POLICY "Instructor manages own lessons" ON public.lessons FOR ALL
  USING (EXISTS (SELECT 1 FROM public.sections s JOIN public.courses c ON c.id = s.course_id WHERE s.id = section_id AND c.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sections s JOIN public.courses c ON c.id = s.course_id WHERE s.id = section_id AND c.instructor_id = auth.uid()));

-- ============ ENROLLMENTS ============
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  stripe_session_id TEXT,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own enrollments" ON public.enrollments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own enrollments" ON public.enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin sees enrollments" ON public.enrollments FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Instructor sees enrollments to own course" ON public.enrollments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid()));

-- ============ LESSON PROGRESS ============
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  watched_seconds INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own progress" ON public.lesson_progress FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ REVIEWS ============
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are public" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users write own reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reviews" ON public.reviews FOR DELETE USING (auth.uid() = user_id);

-- ============ WISHLIST ============
CREATE TABLE public.wishlist (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);
GRANT SELECT, INSERT, DELETE ON public.wishlist TO authenticated;
GRANT ALL ON public.wishlist TO service_role;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wishlist" ON public.wishlist FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ CERTIFICATES ============
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT SELECT, INSERT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own certificates" ON public.certificates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own certificates" ON public.certificates FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ CERTIFICATE AUTO-ISSUE ============
CREATE OR REPLACE FUNCTION public.maybe_issue_certificate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_lessons INT;
  completed_lessons INT;
BEGIN
  IF NEW.completed THEN
    SELECT COUNT(*) INTO total_lessons
      FROM public.lessons l
      JOIN public.sections s ON s.id = l.section_id
      WHERE s.course_id = NEW.course_id;
    SELECT COUNT(*) INTO completed_lessons
      FROM public.lesson_progress lp
      JOIN public.lessons l ON l.id = lp.lesson_id
      JOIN public.sections s ON s.id = l.section_id
      WHERE s.course_id = NEW.course_id AND lp.user_id = NEW.user_id AND lp.completed = true;
    IF total_lessons > 0 AND completed_lessons >= total_lessons THEN
      INSERT INTO public.certificates (user_id, course_id)
      VALUES (NEW.user_id, NEW.course_id)
      ON CONFLICT (user_id, course_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_maybe_issue_certificate
  AFTER INSERT OR UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.maybe_issue_certificate();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SEED 6 COURSES ============
DO $seed$
DECLARE
  c1 UUID; c2 UUID; c3 UUID; c4 UUID; c5 UUID; c6 UUID;
  s_id UUID;
BEGIN
  INSERT INTO public.courses (slug,title,subtitle,description,category,difficulty,price,price_type,duration_text,thumbnail_gradient,status,instructor_name,instructor_bio,rating_avg,rating_count,enrollment_count,what_you_learn,requirements)
  VALUES ('nextjs-14-masterclass','Next.js 14 Masterclass: Build Production Apps','Master App Router, Server Components, and ship real apps to Vercel.',
    'Master Next.js 14 with App Router, Server Components, and deployment to Vercel. Build 3 real production apps.',
    'Development','Intermediate',49,'one_time','18h 30m','from-blue-900 to-purple-700','published','Alex Mercer',
    'Senior engineer & instructor. 12+ years shipping production React.',
    4.8,2341,8920,
    '["Build full-stack apps with Next.js 14 App Router","Master React Server Components & streaming","Auth and data with modern tooling","Deploy production-grade apps to Vercel","Optimize Core Web Vitals","Build a SaaS, a marketplace, and a blog"]'::jsonb,
    '["Basic React knowledge","Node.js 18+ installed","A code editor"]'::jsonb)
  RETURNING id INTO c1;

  INSERT INTO public.courses (slug,title,subtitle,description,category,difficulty,price,price_type,duration_text,thumbnail_gradient,status,instructor_name,instructor_bio,rating_avg,rating_count,enrollment_count,what_you_learn,requirements)
  VALUES ('uiux-design-developers','UI/UX Design for Developers','Design beautiful interfaces without a designer.',
    'A practical UI/UX course built for developers. Learn type, color, spacing, and Figma.',
    'Design','Beginner',39,'one_time','12h 15m','from-pink-500 to-orange-500','published','Priya Nair',
    'Product designer at top startups. Mentor to 200+ developers.',
    4.7,1820,6430,
    '["Color theory & accessible palettes","Typography & visual hierarchy","Spacing, grids & layout","Figma from zero to pro","Design systems for engineers","Prototype interactions"]'::jsonb,
    '["Some web development experience","A free Figma account"]'::jsonb)
  RETURNING id INTO c2;

  INSERT INTO public.courses (slug,title,subtitle,description,category,difficulty,price,price_type,duration_text,thumbnail_gradient,status,instructor_name,instructor_bio,rating_avg,rating_count,enrollment_count,what_you_learn,requirements)
  VALUES ('ai-engineering-langchain','AI Engineering with Python & LangChain','Build production AI agents, RAG systems, and tool-using LLMs.',
    'Architect, build, and ship real AI applications with Python, LangChain, vector DBs, and evaluation.',
    'AI & ML','Advanced',69,'one_time','24h 00m','from-teal-500 to-emerald-600','published','Dr. James Osei',
    'AI researcher & engineer. PhD in ML. Shipped LLM systems at scale.',
    4.9,3102,12300,
    '["LangChain & LangGraph from the ground up","RAG with vector databases","Build tool-using agents","Evaluation & observability","Deploy LLM apps to production","Fine-tune for your domain"]'::jsonb,
    '["Intermediate Python","Basic ML concepts helpful"]'::jsonb)
  RETURNING id INTO c3;

  INSERT INTO public.courses (slug,title,subtitle,description,category,difficulty,price,price_type,duration_text,thumbnail_gradient,status,instructor_name,instructor_bio,rating_avg,rating_count,enrollment_count,what_you_learn,requirements)
  VALUES ('digital-marketing-bootcamp','Digital Marketing Bootcamp 2025','Modern playbook for SEO, paid ads, content, and analytics.',
    'Everything you need to grow a brand in 2025. SEO, paid ads, email, content, analytics.',
    'Marketing','Beginner',29,'one_time','8h 45m','from-orange-500 to-yellow-400','published','Sofia Reyes',
    'Growth marketer for global SaaS brands. Helped scale 4 startups to 7-figure ARR.',
    4.6,980,4200,
    '["SEO fundamentals & keyword research","Google Ads & Meta Ads from scratch","Content strategy that converts","Email marketing playbooks","Analytics & attribution","Building a personal brand"]'::jsonb,
    '["No marketing background required"]'::jsonb)
  RETURNING id INTO c4;

  INSERT INTO public.courses (slug,title,subtitle,description,category,difficulty,price,price_type,duration_text,thumbnail_gradient,status,instructor_name,instructor_bio,rating_avg,rating_count,enrollment_count,what_you_learn,requirements)
  VALUES ('freelancing-mastery','Freelancing Mastery: Land International Clients','Build a freelance business that pays in dollars.',
    'A complete guide to going freelance: positioning, outreach, pricing, contracts, and the systems behind a 6-figure independent business.',
    'Business','Beginner',0,'free','6h 20m','from-green-500 to-lime-400','published','Rayan Chowdhury',
    'Freelance consultant & writer. 80+ international clients across 5 years.',
    4.8,4500,21000,
    '["Position yourself as an expert","Cold outreach that actually works","Pricing & negotiation","Win on Upwork & LinkedIn","Contracts, invoicing, taxes","Build recurring revenue"]'::jsonb,
    '["A skill you can sell"]'::jsonb)
  RETURNING id INTO c5;

  INSERT INTO public.courses (slug,title,subtitle,description,category,difficulty,price,price_type,duration_text,thumbnail_gradient,status,instructor_name,instructor_bio,rating_avg,rating_count,enrollment_count,what_you_learn,requirements)
  VALUES ('docker-devops-fullstack','Docker & DevOps for Full-Stack Developers','Containerize, deploy, and operate real applications.',
    'A practical DevOps course for full-stack devs. Docker, CI/CD, observability, and shipping safely to production.',
    'Development','Advanced',59,'one_time','20h 00m','from-slate-700 to-cyan-500','published','Alex Mercer',
    'Senior engineer & instructor. 12+ years shipping production React.',
    4.7,1650,5800,
    '["Docker & docker-compose deep dive","Build CI/CD pipelines","Kubernetes basics","Logging, metrics, tracing","Zero-downtime deploys","Production incident playbook"]'::jsonb,
    '["Comfortable on the command line","Built at least one web app"]'::jsonb)
  RETURNING id INTO c6;

  -- Course 1 sections
  INSERT INTO public.sections (course_id,title,position) VALUES (c1,'Getting Started',0) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Course Welcome',5,0,true,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Setting Up Your Environment',12,1,true,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Project Walkthrough',9,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'The Next.js Mental Model',18,3,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'App Router vs Pages Router',14,4,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c1,'Server Components Deep Dive',1) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'What Are Server Components?',16,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Server vs Client Boundaries',20,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Streaming UI',18,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Suspense Patterns',22,3,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c1,'Data & Mutations',2) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Server Actions Basics',14,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Forms & Validation',24,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Optimistic Updates',16,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c1,'Shipping to Production',3) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Caching Strategies',22,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Deploying to Vercel',12,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Observability & Errors',18,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');

  -- Course 2
  INSERT INTO public.sections (course_id,title,position) VALUES (c2,'Design Foundations',0) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Why Design Matters for Devs',8,0,true,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Color Theory in 20 Minutes',20,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Typography Fundamentals',18,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c2,'Figma Mastery',1) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Figma Tour',12,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Auto Layout',20,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Variants & Components',24,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c2,'Design Systems',2) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Tokens & Theming',18,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Building a Button',16,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Shipping a Design System',22,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');

  -- Course 3
  INSERT INTO public.sections (course_id,title,position) VALUES (c3,'LangChain Foundations',0) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'What is LangChain?',10,0,true,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Chains & Runnables',24,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Prompts & Templates',18,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c3,'RAG Systems',1) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Vector Databases 101',22,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Chunking Strategies',20,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Building a Production RAG',32,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c3,'Agents',2) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Tools & Function Calling',24,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'LangGraph Workflows',28,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Evaluation & Guardrails',26,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');

  -- Course 4
  INSERT INTO public.sections (course_id,title,position) VALUES (c4,'Modern Marketing Mindset',0) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Welcome',5,0,true,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'The Funnel in 2025',16,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Picking Channels',14,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c4,'SEO',1) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Keyword Research',18,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'On-Page SEO',16,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Link Building',22,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c4,'Paid Ads',2) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Google Ads from Scratch',24,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Meta Ads from Scratch',24,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');

  -- Course 5 (FREE)
  INSERT INTO public.sections (course_id,title,position) VALUES (c5,'Positioning',0) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Welcome',6,0,true,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Finding Your Niche',18,1,true,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Personal Brand',14,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c5,'Getting Clients',1) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Cold Outreach',20,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'LinkedIn Playbook',18,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Pricing Yourself',22,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c5,'Running the Business',2) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Contracts',12,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Invoicing & Taxes',16,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');

  -- Course 6
  INSERT INTO public.sections (course_id,title,position) VALUES (c6,'Docker Foundations',0) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Containers vs VMs',12,0,true,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Your First Dockerfile',20,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Multi-stage Builds',18,2,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c6,'CI/CD',1) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'GitHub Actions Basics',22,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Deploy Pipelines',20,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
  INSERT INTO public.sections (course_id,title,position) VALUES (c6,'Observability',2) RETURNING id INTO s_id;
  INSERT INTO public.lessons (section_id,title,duration_minutes,position,is_preview,video_url) VALUES
    (s_id,'Logs, Metrics, Traces',24,0,false,'https://www.youtube.com/embed/dQw4w9WgXcQ'),
    (s_id,'Incident Response',18,1,false,'https://www.youtube.com/embed/dQw4w9WgXcQ');
END
$seed$;
