import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAllBookings } from "@/lib/bookings.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar as CalIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  component: BookingsPage,
});

function BookingsPage() {
  const fn = useServerFn(listAllBookings);
  const q = useQuery({ queryKey: ["all-bookings"], queryFn: () => fn() });
  const now = Date.now();
  const rows = q.data ?? [];
  const upcoming = rows.filter((r) => new Date(r.start_at).getTime() > now);
  const past = rows.filter((r) => new Date(r.start_at).getTime() <= now).reverse();

  return (
    <div className="space-y-8">
      <Section title="Upcoming" rows={upcoming} />
      <Section title="Past" rows={past} muted />
      {rows.length === 0 && !q.isLoading && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No bookings yet.</CardContent></Card>
      )}
    </div>
  );
}

function Section({ title, rows, muted }: {
  title: string;
  rows: Array<{
    id: string;
    start_at: string;
    end_at: string;
    event_type: { title: string; color: string; capacity: number } | null;
    attendees: Array<{ id: string; email: string; full_name: string | null; notes: string | null }>;
  }>;
  muted?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="space-y-2">
        {rows.map((b) => (
          <Card key={b.id} className={muted ? "opacity-70" : ""}>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: b.event_type?.color ?? "#999" }} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{b.event_type?.title}</div>
                  <div className="text-sm text-muted-foreground">
                    <CalIcon className="mr-1 inline h-3 w-3" />
                    {new Date(b.start_at).toLocaleString(undefined, {
                      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" /> {b.attendees.length}
                  {b.event_type && b.event_type.capacity > 1 && `/${b.event_type.capacity}`}
                </Badge>
              </div>
              <div className="mt-3 space-y-1 border-t border-border/60 pt-3">
                {b.attendees.map((a) => (
                  <div key={a.id} className="text-sm">
                    <span className="font-medium">{a.full_name || a.email}</span>
                    <span className="ml-2 text-muted-foreground">{a.email}</span>
                    {a.notes && <div className="text-xs italic text-muted-foreground">"{a.notes}"</div>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}