import { useEffect, useState } from 'react';

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [slots, setSlots] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', startTime: '', endTime: '', capacity: 1 });

  useEffect(() => { fetchSlots(); }, []);
  async function fetchSlots(){
    const res = await fetch('/api/slots');
    setSlots(await res.json());
  }

  async function createSlot(e:any){
    e.preventDefault();
    if (!token) return alert('Enter ADMIN token');
    const res = await fetch('/api/slots', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(form) });
    if (res.ok){ setForm({ title:'', startTime:'', endTime:'', capacity:1 }); fetchSlots(); alert('Created'); }
    else { const j = await res.json(); alert(j.error || 'Failed'); }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Admin Dashboard</h1>
      <div className="mb-4">
        <label className="block mb-1">Admin token (keeps API protected)</label>
        <input value={token} onChange={e=>setToken(e.target.value)} className="p-2 border w-full" />
      </div>

      <form onSubmit={createSlot} className="mb-6 grid gap-2 max-w-md">
        <input required placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="p-2 border" />
        <input required type="datetime-local" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})} className="p-2 border" />
        <input required type="datetime-local" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})} className="p-2 border" />
        <input required type="number" value={form.capacity} min={1} onChange={e=>setForm({...form,capacity:Number(e.target.value)})} className="p-2 border" />
        <button className="px-3 py-2 bg-blue-600 text-white">Create Slot</button>
      </form>

      <h2 className="text-xl mb-2">Slots</h2>
      <div className="grid gap-3">
        {slots.map(s=> (
          <div key={s.id} className="p-3 border">
            <div className="font-semibold">{s.title}</div>
            <div>{new Date(s.startTime).toLocaleString()} - {new Date(s.endTime).toLocaleString()}</div>
            <div>Capacity: {s.capacity} — Remaining: {s.remaining}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
