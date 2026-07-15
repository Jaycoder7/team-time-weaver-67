
ALTER TABLE public.booking_attendees ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.booking_attendees DROP CONSTRAINT IF EXISTS booking_attendees_booking_id_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS booking_attendees_booking_user_uniq
  ON public.booking_attendees(booking_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS booking_attendees_booking_email_uniq
  ON public.booking_attendees(booking_id, lower(email));
