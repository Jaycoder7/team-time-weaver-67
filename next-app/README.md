# Booking App (Next.js) - Scaffold

This scaffold implements a simple booking app with:
- Admin connects a Google Calendar (OAuth) and stores refresh token in DB.
- Admin creates slots (capacity enforced in DB).
- Public booking page that allows guest bookings without accounts.
- Capacity checks performed inside a DB transaction to prevent overbooking.
- Google Calendar event created/updated per slot (guests not added as attendees).
- Confirmation emails sent via Resend; cancellation via secure token.

Quick setup:

1. Create a PostgreSQL database and set DATABASE_URL.
2. Set env vars in .env:
   - DATABASE_URL
   - NEXT_PUBLIC_BASE_URL (e.g. https://your-domain)
   - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
   - RESEND_API_KEY, RESEND_FROM_EMAIL
   - ADMIN_TOKEN (simple admin auth for creating slots)
3. Install dependencies: `cd next-app && npm install`
4. Run Prisma migrations:
   - `npx prisma generate`
   - `npx prisma migrate dev --name init`
5. Dev: `npm run dev`

Deployment:
- Deploy to Vercel and set environment variables in the project settings.
- Set Redirect URI in Google OAuth to <BASE_URL>/api/admin/oauth/callback

Notes:
- This is a scaffold — refine UI and add tests as needed.
- Security: ADMIN_TOKEN is a simple guard for admin APIs; replace with real auth in production.
