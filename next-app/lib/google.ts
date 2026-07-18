import { google } from 'googleapis';
import { prisma } from './prisma';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/oauth/callback`
);

export function generateAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent'
  });
}

export async function handleOAuthCallback(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) throw new Error('Missing refresh token; ensure prompt=consent');
  const refreshToken = tokens.refresh_token;
  // store refresh token in Admin record
  await prisma.admin.upsert({ where: { id: 1 }, update: { googleRefreshToken: refreshToken }, create: { googleRefreshToken: refreshToken } });
  return true;
}

export async function createOrUpdateCalendarEvent(slotId: string) {
  const admin = await prisma.admin.findUnique({ where: { id: 1 } });
  if (!admin?.googleRefreshToken) return;
  oauth2Client.setCredentials({ refresh_token: admin.googleRefreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const slot = await prisma.slot.findUnique({ where: { id: slotId }, include: { bookings: true } });
  if (!slot) return;
  const attendeesCount = slot.bookings.filter(b => b.status === 'CONFIRMED').reduce((s, b) => s + b.attendeeCount, 0);
  const description = `Bookings: ${attendeesCount}/${slot.capacity}\n\nDo not add guests as calendar attendees.`;

  if (slot.googleEventId) {
    await calendar.events.patch({ calendarId: admin.calendarId || 'primary', eventId: slot.googleEventId, requestBody: { description } });
  } else {
    const event = await calendar.events.insert({ calendarId: admin.calendarId || 'primary', requestBody: {
      summary: slot.title,
      description,
      start: { dateTime: slot.startTime.toISOString() },
      end: { dateTime: slot.endTime.toISOString() },
      attendees: []
    }});
    await prisma.slot.update({ where: { id: slotId }, data: { googleEventId: event.data.id } });
  }
}
