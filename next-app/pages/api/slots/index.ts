import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const slots = await prisma.slot.findMany({ include: { bookings: true }, orderBy: { startTime: 'asc' } });
    const mapped = slots.map(s => {
      const confirmed = s.bookings.filter(b => b.status === 'CONFIRMED').reduce((a, b) => a + b.attendeeCount, 0);
      return { ...s, remaining: s.capacity - confirmed };
    });
    return res.json(mapped);
  }

  if (req.method === 'POST') {
    // Admin create slot - minimal auth via ADMIN_TOKEN
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
    const { title, startTime, endTime, capacity } = req.body;
    if (!title || !startTime || !endTime || !capacity) return res.status(400).json({ error: 'Missing' });
    const slot = await prisma.slot.create({ data: { title, startTime: new Date(startTime), endTime: new Date(endTime), capacity: Number(capacity) } });
    return res.status(201).json(slot);
  }

  res.setHeader('Allow', ['GET','POST']);
  res.status(405).end();
}
