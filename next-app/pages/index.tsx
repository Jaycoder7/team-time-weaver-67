import { useEffect, useState } from 'react';

export default function Home() {
  const [slots, setSlots] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', email: '', attendeeCount: 1, slotId: '' });

  useEffect(() => {
    fetch('/api/slots').then(r => r.json()).then(setSlots);
  }, []);

  async function book(e:any) {
    e.preventDefault();
    const r = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const json = await r.json();
    if (r.ok) {
      window.location.href = `/booking/confirmed?id=${json.booking.id}`;
    } else alert(json.error || 'Failed');
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Book a slot</h1>
      <div className="grid gap-4">
        {slots.map(s => (
          <div key={s.id} className="p-4 border">
            <div className="font-semibold">{s.title}</div>
            <div>{new Date(s.startTime).toLocaleString()} — {new Date(s.endTime).toLocaleString()}</div>
            <div>Remaining: {s.remaining}</div>
            <button onClick={() => setForm({ ...form, slotId: s.id })} className="mt-2 px-2 py-1 bg-blue-600 text-white">Select</button>
          </div>
        ))}
      </div>

      <form onSubmit={book} className="mt-6 max-w-md">
        <input required placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full p-2 border mb-2" />
        <input required placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full p-2 border mb-2" />
        <input required type="number" min={1} placeholder="Attendees" value={form.attendeeCount} onChange={e=>setForm({...form,attendeeCount:Number(e.target.value)})} className="w-full p-2 border mb-2" />
        <button className="px-4 py-2 bg-green-600 text-white">Book</button>
      </form>
    </div>
  );
}
