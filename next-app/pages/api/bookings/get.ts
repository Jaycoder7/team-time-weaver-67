import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string | undefined;
  if (!id) return res.status(400).json({ error: 'Missing' });
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return res.status(404).json({ error: 'Not found' });
  res.json(booking);
}
