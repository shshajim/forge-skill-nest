
-- 1) Move has_role out of exposed public schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate course policies to use private.has_role and prevent self-approval
DROP POLICY IF EXISTS "Admin reads all courses" ON public.courses;
DROP POLICY IF EXISTS "Admin updates any course" ON public.courses;
DROP POLICY IF EXISTS "Instructor creates courses" ON public.courses;
DROP POLICY IF EXISTS "Instructor updates own courses" ON public.courses;

CREATE POLICY "Admin reads all courses" ON public.courses
  FOR SELECT USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin updates any course" ON public.courses
  FOR UPDATE USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructor creates courses" ON public.courses
  FOR INSERT WITH CHECK (
    auth.uid() = instructor_id
    AND private.has_role(auth.uid(), 'instructor')
    AND status IN ('draft','pending_review')
  );
CREATE POLICY "Instructor updates own courses" ON public.courses
  FOR UPDATE USING (auth.uid() = instructor_id)
  WITH CHECK (
    auth.uid() = instructor_id
    AND status IN ('draft','pending_review','rejected')
  );

-- Trigger: prevent instructors from tampering with review columns
CREATE OR REPLACE FUNCTION public.enforce_course_review_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.review_note := OLD.review_note;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_course_review_fields ON public.courses;
CREATE TRIGGER trg_enforce_course_review_fields
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.enforce_course_review_fields();

-- Revoke client access to the old public.has_role (kept only if still depended on)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- 2) Certificates: remove self-insert; trigger already issues them
DROP POLICY IF EXISTS "Users insert own certificates" ON public.certificates;
REVOKE INSERT ON public.certificates FROM authenticated, anon;

-- 3) Profiles: restrict SELECT to owner + admin; expose a safe public view
DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT USING (private.has_role(auth.uid(), 'admin'));

-- Public view bypasses RLS but exposes only non-sensitive columns
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT id, full_name, avatar_url FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
