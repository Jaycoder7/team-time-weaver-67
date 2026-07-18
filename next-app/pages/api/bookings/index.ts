import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { sendConfirmationEmail } from '../../../lib/email';
import { createOrUpdateCalendarEvent } from '../../../lib/google';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { slotId, name, email, attendeeCount } = req.body;
  if (!slotId || !name || !email || !attendeeCount) return res.status(400).json({ error: 'Missing' });

  try {
    // Transaction with SELECT FOR UPDATE to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      const slots = await tx.$queryRaw`SELECT * FROM "Slot" WHERE id = ${slotId} FOR UPDATE`;
      const slot = slots[0] as any;
      if (!slot) throw new Error('Slot not found');
      const confirmed = await tx.booking.aggregate({ _sum: { attendeeCount: true }, where: { slotId, status: 'CONFIRMED' } });
      const total = (confirmed._sum.attendeeCount ?? 0) + Number(attendeeCount);
      if (total > slot.capacity) throw new Error('Not enough capacity');
      const token = uuidv4();
      const booking = await tx.booking.create({ data: { slotId, name, email, attendeeCount: Number(attendeeCount), cancellationToken: token } });
      return { booking, slotId };
    });

    // After commit: update calendar and send email async
    createOrUpdateCalendarEvent(result.slotId).catch(console.error);
    const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/booking/cancel?token=${result.booking.cancellationToken}`;
    const html = `<p>Thanks ${result.booking.name} — your booking is confirmed.</p><p>Cancel: <a href="${cancelUrl}">Cancel booking</a></p>`;
    sendConfirmationEmail(result.booking.email, 'Booking confirmed', html).catch(console.error);

    return res.status(201).json({ booking: result.booking });
  } catch (e:any) {
    return res.status(400).json({ error: e.message });
  }
}
