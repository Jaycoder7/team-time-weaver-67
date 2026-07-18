import type { NextApiRequest, NextApiResponse } from 'next';
import { generateAuthUrl } from '../../../lib/google';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = generateAuthUrl();
  res.redirect(url);
}
