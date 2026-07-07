
-- Courses
DROP POLICY IF EXISTS "Admin reads all courses" ON public.courses;
DROP POLICY IF EXISTS "Admin updates any course" ON public.courses;
DROP POLICY IF EXISTS "Instructor creates courses" ON public.courses;
DROP POLICY IF EXISTS "Instructor updates own courses" ON public.courses;
DROP POLICY IF EXISTS "Instructor reads own courses" ON public.courses;
DROP POLICY IF EXISTS "Instructor deletes own draft" ON public.courses;

CREATE POLICY "Admin reads all courses" ON public.courses
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin updates any course" ON public.courses
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructor creates courses" ON public.courses
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = instructor_id
    AND private.has_role(auth.uid(), 'instructor')
    AND status IN ('draft','pending_review')
  );
CREATE POLICY "Instructor updates own courses" ON public.courses
  FOR UPDATE TO authenticated USING (auth.uid() = instructor_id)
  WITH CHECK (
    auth.uid() = instructor_id
    AND status IN ('draft','pending_review','rejected')
  );
CREATE POLICY "Instructor reads own courses" ON public.courses
  FOR SELECT TO authenticated USING (auth.uid() = instructor_id);
CREATE POLICY "Instructor deletes own draft" ON public.courses
  FOR DELETE TO authenticated USING (
    auth.uid() = instructor_id AND status IN ('draft','rejected')
  );

-- Sections
DROP POLICY IF EXISTS "Sections readable for published" ON public.sections;
CREATE POLICY "Sections readable published" ON public.sections
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = sections.course_id AND c.status = 'published'
  ));
CREATE POLICY "Sections readable authenticated" ON public.sections
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = sections.course_id
      AND (c.status = 'published' OR c.instructor_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))
  ));

-- Lessons
DROP POLICY IF EXISTS "Lessons readable for published" ON public.lessons;
CREATE POLICY "Lessons readable published" ON public.lessons
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM public.sections s
    JOIN public.courses c ON c.id = s.course_id
    WHERE s.id = lessons.section_id AND c.status = 'published'
  ));
CREATE POLICY "Lessons readable authenticated" ON public.lessons
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.sections s
    JOIN public.courses c ON c.id = s.course_id
    WHERE s.id = lessons.section_id
      AND (c.status = 'published' OR c.instructor_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))
  ));

-- Enrollments
DROP POLICY IF EXISTS "Admin sees enrollments" ON public.enrollments;
CREATE POLICY "Admin sees enrollments" ON public.enrollments
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- user_roles admin
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- Profiles admin
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));
