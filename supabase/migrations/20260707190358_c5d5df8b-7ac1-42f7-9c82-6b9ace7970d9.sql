
DROP POLICY IF EXISTS "Public reads limited profile columns" ON public.profiles;

-- Restore full-column grants; RLS now gates access (owner + admin only)
GRANT SELECT ON public.profiles TO authenticated;
REVOKE SELECT ON public.profiles FROM anon;
