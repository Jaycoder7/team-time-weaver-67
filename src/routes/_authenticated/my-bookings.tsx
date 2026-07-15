import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyBookings, cancelMyBooking } from "@/lib/bookings.functions";
import { getMe } from "@/lib/session.functions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar as CalIcon, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-bookings")({
  component: MyBookings,
});

function MyBookings() {
  const meFn = useServerFn(getMe);
  const listFn = useServerFn(listMyBookings);
  const cancelFn = useServerFn(cancelMyBooking);
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const q = useQuery({ queryKey: ["my-bookings"], queryFn: () => listFn() });

  const cancel = useMutation({
    mutationFn: async (bookingId: string) => cancelFn({ data: { bookingId } }),
    onSuccess: () => {
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (q.data ?? []).filter((r) => r.booking);
  const upcoming = rows.filter((r) => new Date(r.booking!.start_at).getTime() > Date.now());
  const past = rows.filter((r) => new Date(r.booking!.start_at).getTime() <= Date.now());

  return (
    <AppShell isOwner={me.data?.isOwner} email={me.data?.profile?.email}>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">My bookings</h1>

      <Section title="Upcoming" rows={upcoming} onCancel={(id) => cancel.mutate(id)} showCancel />
      <div className="mt-8">
        <Section title="Past" rows={past} muted />
      </div>

      {rows.length === 0 && !q.isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You haven't booked anything yet.{" "}
            <Link to="/" className="text-primary underline underline-offset-4">Browse event types</Link>.
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function Section({
  title,
  rows,
  onCancel,
  showCancel,
  muted,
}: {
  title: string;
  rows: Array<{
    id: string;
    notes: string | null;
    booking: {
      id: string;
      start_at: string;
      end_at: string;
      event_type: { title: string; color: string; capacity: number; duration_min: number } | null;
    } | null;
  }>;
  onCancel?: (id: string) => void;
  showCancel?: boolean;
  muted?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="space-y-2">
        {rows.map((r) => {
          const start = new Date(r.booking!.start_at);
          const et = r.booking!.event_type;
          return (
            <Card key={r.id} className={muted ? "opacity-70" : ""}>
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: et?.color ?? "#999" }} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{et?.title ?? "Event"}</div>
                  <div className="text-sm text-muted-foreground">
                    <CalIcon className="mr-1 inline h-3 w-3" />
                    {start.toLocaleString(undefined, {
                      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </div>
                </div>
                {et && et.capacity > 1 && (
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" /> group
                  </Badge>
                )}
                {showCancel && onCancel && (
                  <Button variant="outline" size="sm" onClick={() => onCancel(r.booking!.id)}>
                    Cancel
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}