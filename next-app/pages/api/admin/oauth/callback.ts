import type { NextApiRequest, NextApiResponse } from 'next';
import { handleOAuthCallback } from '../../../lib/google';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).send('Missing code');
  try {
    await handleOAuthCallback(code);
    res.send('OK - Google connected.');
  } catch (e:any) {
    res.status(500).send(String(e));
  }
}
