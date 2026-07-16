
DROP POLICY IF EXISTS "read profiles" ON public.profiles;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "view availability" ON public.availability_rules;
CREATE POLICY "owner reads availability" ON public.availability_rules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND owner_id = auth.uid());
