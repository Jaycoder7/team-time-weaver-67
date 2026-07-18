import { useState } from 'react';

export default function CancelPage() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  async function cancel(e:any) {
    e.preventDefault();
    const r = await fetch('/api/bookings/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const j = await r.json();
    if (r.ok) setStatus('Cancelled'); else setStatus(j.error || 'Failed');
  }
  return (
    <div className="p-6">
      <h1 className="text-2xl">Cancel booking</h1>
      <form onSubmit={cancel} className="mt-4">
        <input value={token} onChange={e=>setToken(e.target.value)} placeholder="Cancellation token" className="p-2 border mb-2" />
        <button className="px-3 py-1 bg-red-600 text-white">Cancel</button>
      </form>
      {status && <div className="mt-4">{status}</div>}
    </div>
  );
}
