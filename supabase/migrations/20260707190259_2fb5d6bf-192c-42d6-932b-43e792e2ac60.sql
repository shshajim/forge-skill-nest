
-- Rewrite remaining policies to use private.has_role
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Sections readable for published" ON public.sections;
CREATE POLICY "Sections readable for published" ON public.sections
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = sections.course_id
      AND (c.status = 'published' OR c.instructor_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))
  ));

DROP POLICY IF EXISTS "Lessons readable for published" ON public.lessons;
CREATE POLICY "Lessons readable for published" ON public.lessons
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.sections s
    JOIN public.courses c ON c.id = s.course_id
    WHERE s.id = lessons.section_id
      AND (c.status = 'published' OR c.instructor_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))
  ));

DROP POLICY IF EXISTS "Admin sees enrollments" ON public.enrollments;
CREATE POLICY "Admin sees enrollments" ON public.enrollments
  FOR SELECT USING (private.has_role(auth.uid(), 'admin'));

-- Now drop old public function
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Lock down definer functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.maybe_issue_certificate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_course_review_fields() FROM PUBLIC;

-- Replace the view approach with column-level grants on profiles
DROP VIEW IF EXISTS public.public_profiles;

CREATE POLICY "Public reads limited profile columns" ON public.profiles
  FOR SELECT USING (true);

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, avatar_url, is_banned, created_at) ON public.profiles TO anon, authenticated;
GRANT SELECT (email) ON public.profiles TO service_role;
