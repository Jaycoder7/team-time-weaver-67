
CREATE OR REPLACE FUNCTION public.is_booking_attendee(_booking_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.booking_attendees WHERE booking_id = _booking_id AND user_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.is_booking_attendee(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_booking_attendee(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "view attendees" ON public.booking_attendees;
CREATE POLICY "view attendees" ON public.booking_attendees FOR SELECT
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR user_id = auth.uid()
  OR public.is_booking_attendee(booking_id, auth.uid())
);

DROP POLICY IF EXISTS "view bookings" ON public.bookings;
CREATE POLICY "view bookings" ON public.bookings FOR SELECT
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR public.is_booking_attendee(id, auth.uid())
);
