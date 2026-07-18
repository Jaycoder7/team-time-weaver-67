import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function Confirmed() {
  const router = useRouter();
  const { id } = router.query;
  const [booking, setBooking] = useState<any>(null);
  useEffect(() => {
    if (!id) return;
    fetch(`/api/bookings?id=${id}`).then(r=>r.json()).then(setBooking);
  }, [id]);
  if (!booking) return <div className="p-6">Loading…</div>;
  return (
    <div className="p-6">
      <h1 className="text-2xl">Booking Confirmed</h1>
      <p>Thanks {booking.name}. A confirmation was sent to {booking.email}.</p>
    </div>
  );
}
