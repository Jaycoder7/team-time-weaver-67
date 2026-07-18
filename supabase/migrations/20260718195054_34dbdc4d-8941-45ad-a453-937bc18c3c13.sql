
-- Make every new user an owner
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

-- Backfill existing users as owner
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- Scope event_types per owner
DROP POLICY IF EXISTS "owner manages event types" ON public.event_types;
DROP POLICY IF EXISTS "view event types" ON public.event_types;
CREATE POLICY "owner manages own event types" ON public.event_types
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner') AND owner_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'owner') AND owner_id = auth.uid());
CREATE POLICY "view own or active event types" ON public.event_types
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR active);

-- Scope availability per owner (ALL policy)
DROP POLICY IF EXISTS "owner manages availability" ON public.availability_rules;
CREATE POLICY "owner manages own availability" ON public.availability_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner') AND owner_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'owner') AND owner_id = auth.uid());

-- Scope bookings per owner (via event_types.owner_id)
DROP POLICY IF EXISTS "owner manages bookings" ON public.bookings;
DROP POLICY IF EXISTS "view bookings" ON public.bookings;
CREATE POLICY "owner manages own bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.event_types et WHERE et.id = bookings.event_type_id AND et.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.event_types et WHERE et.id = bookings.event_type_id AND et.owner_id = auth.uid()));
CREATE POLICY "view own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.event_types et WHERE et.id = bookings.event_type_id AND et.owner_id = auth.uid())
    OR is_booking_attendee(id, auth.uid())
  );

-- Scope booking_attendees to the event owner or the attendee themselves
DROP POLICY IF EXISTS "view attendees" ON public.booking_attendees;
CREATE POLICY "view own or own-event attendees" ON public.booking_attendees
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.event_types et ON et.id = b.event_type_id
      WHERE b.id = booking_attendees.booking_id AND et.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete own attendance" ON public.booking_attendees;
CREATE POLICY "delete own or own-event attendance" ON public.booking_attendees
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.event_types et ON et.id = b.event_type_id
      WHERE b.id = booking_attendees.booking_id AND et.owner_id = auth.uid()
    )
  );

-- Tighten profile visibility to just yourself
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
CREATE POLICY "read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);
