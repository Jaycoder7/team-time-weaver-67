
DROP POLICY IF EXISTS "insert own booking" ON public.bookings;
CREATE POLICY "insert booking for active event type" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.event_types et WHERE et.id = event_type_id AND et.active));

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
