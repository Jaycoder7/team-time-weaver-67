
-- 1) Restrict SELECT on booking_attendees: owner or self only
DROP POLICY IF EXISTS "view attendees" ON public.booking_attendees;
CREATE POLICY "view attendees"
ON public.booking_attendees
FOR SELECT
USING (
  public.has_role(auth.uid(), 'owner'::app_role)
  OR user_id = auth.uid()
);

-- 2) Enforce capacity + duplicate prevention at DB level
CREATE OR REPLACE FUNCTION public.enforce_booking_attendee_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap INT;
  current_count INT;
  dup_count INT;
BEGIN
  SELECT et.capacity INTO cap
  FROM public.bookings b
  JOIN public.event_types et ON et.id = b.event_type_id
  WHERE b.id = NEW.booking_id;

  IF cap IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM public.booking_attendees
  WHERE booking_id = NEW.booking_id;

  IF current_count >= cap THEN
    RAISE EXCEPTION 'This slot is full';
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO dup_count
    FROM public.booking_attendees
    WHERE booking_id = NEW.booking_id AND user_id = NEW.user_id;
    IF dup_count > 0 THEN
      RAISE EXCEPTION 'Already registered for this slot';
    END IF;
  END IF;

  IF NEW.email IS NOT NULL THEN
    SELECT COUNT(*) INTO dup_count
    FROM public.booking_attendees
    WHERE booking_id = NEW.booking_id AND lower(email) = lower(NEW.email);
    IF dup_count > 0 THEN
      RAISE EXCEPTION 'This email is already registered for this slot';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_attendee_capacity_trg ON public.booking_attendees;
CREATE TRIGGER enforce_booking_attendee_capacity_trg
BEFORE INSERT ON public.booking_attendees
FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_attendee_capacity();
