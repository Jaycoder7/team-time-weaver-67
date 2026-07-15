
# Team Calendly — Plan

A booking app where **you** (the owner) connect **your** Google Calendar once, define bookable event types, and your teammates sign in with email to reserve slots. You control whether each event type allows a single booking per slot or multiple attendees.

## Scope

- **Owner** = you. One Google Calendar connection (workspace connector `google_calendar`), used for availability + creating events.
- **Attendees** = your teammates. They sign in with email (magic link / password) and book.
- Not per-user Google auth. Not public-internet Calendly. Only signed-in users can book.

## Core features

1. **Owner Google Calendar connection** (one-time, by you)
   - Use the existing `google_calendar` App connector (already linked based on the message).
   - All availability + event creation runs against your calendar via the connector gateway.

2. **Event Types** (owner-managed)
   - Fields: title, description, duration (15/30/45/60/90 min or custom), color, active toggle.
   - `capacity` (int, default 1) — max attendees per slot. >1 = group slot.
   - `buffer_before` / `buffer_after` minutes.
   - `min_notice_hours`, `max_days_ahead`.
   - Weekly availability windows (e.g. Mon–Fri 9:00–17:00 in owner's timezone).

3. **Booking flow (teammate)**
   - Sign in (email/password + Google sign-in).
   - Pick event type → see calendar of available days → pick a day → see time slots.
   - Slot generation: split each availability window into duration-sized slots, subtract owner's busy events (from Google Calendar `freebusy`) + buffer, subtract fully-booked slots (attendee count ≥ capacity).
   - Book: creates a `bookings` row + adds/updates the Google Calendar event on your calendar, inviting the attendee's email.
   - For group slots (capacity > 1): reusing the same start/end reuses the same Google Calendar event and adds the new attendee to it.
   - Cancel own booking: removes attendee from the Google event (deletes event if last attendee).

4. **Owner dashboard**
   - List of event types (create/edit/delete/toggle).
   - Upcoming bookings across all event types with attendee list.
   - Weekly availability editor.

5. **Auth & roles**
   - Lovable Cloud auth. Email/password + Google sign-in.
   - `user_roles` table with `owner` and `member` roles. First signup is owner; owner can promote others (out of MVP scope — first user = owner is fine).
   - Only `owner` can manage event types, availability, and see all bookings. Members book + see their own bookings.

## Technical details

**Stack:** existing TanStack Start + Lovable Cloud (Supabase) + `google_calendar` connector gateway.

**DB (migration):**
- `profiles(id uuid pk → auth.users, email, full_name, timezone)`
- `app_role` enum: `owner | member`
- `user_roles(user_id, role)` + `has_role()` security-definer fn
- `event_types(id, owner_id, title, slug unique, description, duration_min, capacity, buffer_before_min, buffer_after_min, min_notice_hours, max_days_ahead, color, active, created_at)`
- `availability_rules(id, owner_id, weekday 0-6, start_time, end_time)`
- `bookings(id, event_type_id, start_at timestamptz, end_at timestamptz, google_event_id, created_by uuid, status, notes)`
- `booking_attendees(id, booking_id, user_id, email, created_at, unique(booking_id, user_id))`
- Trigger to auto-create profile on `auth.users` insert.
- RLS: members read active event types + availability; owner full CRUD; attendees see own bookings; owner sees all.
- GRANTs to `authenticated` per public-schema-grants.

**Server functions** (`src/lib/*.functions.ts`):
- `listEventTypes`, `getEventType(slug)`
- `getAvailability(eventTypeId, monthStart)` — computes free slots by calling Google Calendar `freebusy.query` through the gateway + subtracting existing bookings.
- `createBooking({eventTypeId, startAt, notes})` — creates/updates Google event (`events.insert` or `events.patch` to add attendee), inserts booking row.
- `cancelBooking(bookingId)` — patches Google event to remove attendee, deletes event if empty.
- Owner-only: `upsertEventType`, `deleteEventType`, `upsertAvailability`, `listAllBookings`.
- All Google calls go through `https://connector-gateway.lovable.dev/google_calendar/calendar/v3/...` with `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${GOOGLE_CALENDAR_API_KEY}`.

**Routes:**
```
/                        → landing / event type list (public? -> requires login to book)
/auth                    → sign in / sign up (email + Google)
/_authenticated/
  book/$slug             → date + slot picker + confirm
  my-bookings            → attendee's own bookings
  admin/                 → owner-only (guarded by has_role check)
    event-types          → CRUD list
    event-types/$id      → editor
    availability         → weekly hours editor
    bookings             → all bookings
```

**Design:** clean, calm scheduling UI — soft neutrals, one accent color, generous spacing, no purple gradients. Cards for event types, week grid for availability, day+slot grid for booking (Cal.com-ish).

## Assumptions I'll make (tell me to change any)

- First user to sign up becomes the `owner`. Later signups are `member`.
- Owner timezone drives availability; attendees see slots in their browser timezone.
- No payments, no reminders/emails beyond the Google Calendar invite.
- Group slots: single Google Calendar event with multiple attendees (not one event per attendee).

## Build order

1. Enable Lovable Cloud, set up auth (email + Google) and roles.
2. Migration for all tables + RLS + grants + profile trigger.
3. Design system tweaks + shared layout.
4. Owner admin pages (event types, availability).
5. Booking flow (availability computation via Google `freebusy`, slot picker, create/cancel with Google Calendar sync).
6. My bookings + owner bookings list.
