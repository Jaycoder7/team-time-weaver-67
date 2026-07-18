import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { createOrUpdateCalendarEvent } from '../../../lib/google';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing' });
  const booking = await prisma.booking.findUnique({ where: { cancellationToken: token } });
  if (!booking) return res.status(404).json({ error: 'Not found' });
  if (booking.status === 'CANCELLED') return res.status(200).json({ ok: true });
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
  createOrUpdateCalendarEvent(booking.slotId).catch(console.error);
  return res.json({ ok: true });
}
