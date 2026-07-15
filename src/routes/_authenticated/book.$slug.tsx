import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getEventTypeBySlug } from "@/lib/event-types.functions";
import { getSlotsForDay } from "@/lib/slots.functions";
import { createBooking } from "@/lib/bookings.functions";
import { getMe } from "@/lib/session.functions";
import { AppShell } from "@/components/app-shell";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Users, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/book/$slug")({
  component: BookPage,
});

function toDateISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function BookPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meFn = useServerFn(getMe);
  const getEtFn = useServerFn(getEventTypeBySlug);
  const getSlotsFn = useServerFn(getSlotsForDay);
  const createFn = useServerFn(createBooking);

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const et = useQuery({
    queryKey: ["event-type", slug],
    queryFn: () => getEtFn({ data: { slug } }),
  });

  const dateISO = date ? toDateISO(date) : null;
  const slots = useQuery({
    queryKey: ["slots", et.data?.id, dateISO],
    queryFn: () => getSlotsFn({ data: { eventTypeId: et.data!.id, dateISO: dateISO! } }),
    enabled: !!et.data && !!dateISO,
  });

  const book = useMutation({
    mutationFn: async () => createFn({ data: { eventTypeId: et.data!.id, startISO: selectedISO!, notes } }),
    onSuccess: () => {
      toast.success("Booked! Added to the calendar.");
      qc.invalidateQueries({ queryKey: ["slots"] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      navigate({ to: "/my-bookings" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }),
    [],
  );

  if (et.isLoading) return <AppShell isOwner={me.data?.isOwner} email={me.data?.profile?.email}><p>Loading…</p></AppShell>;
  if (!et.data)
    return (
      <AppShell isOwner={me.data?.isOwner} email={me.data?.profile?.email}>
        <p>Event type not found.</p>
        <Button asChild variant="link"><Link to="/">Back</Link></Button>
      </AppShell>
    );

  const eventType = et.data;

  return (
    <AppShell isOwner={me.data?.isOwner} email={me.data?.profile?.email}>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> All event types</Link>
      </Button>

      <div className="mb-8 flex items-start gap-3">
        <span className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: eventType.color }} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{eventType.title}</h1>
          {eventType.description && (
            <p className="mt-1 text-muted-foreground">{eventType.description}</p>
          )}
          <div className="mt-2 flex gap-2">
            <Badge variant="secondary">{eventType.duration_min} min</Badge>
            {eventType.capacity > 1 && (
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" /> up to {eventType.capacity} attendees
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Pick a date</CardTitle></CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { setDate(d); setSelectedISO(null); }}
              disabled={{ before: new Date() }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {date ? date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Pick a date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {slots.isLoading && <p className="text-sm text-muted-foreground">Loading slots…</p>}
            {slots.data && slots.data.length === 0 && (
              <p className="text-sm text-muted-foreground">No availability on this day.</p>
            )}
            {slots.data && slots.data.length > 0 && (
              <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
                {slots.data.map((s) => {
                  const disabled = s.full || s.joined;
                  const selected = selectedISO === s.startISO;
                  return (
                    <button
                      key={s.startISO}
                      disabled={disabled}
                      onClick={() => setSelectedISO(s.startISO)}
                      className={
                        "rounded-md border px-3 py-2 text-sm transition-colors " +
                        (selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : disabled
                            ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
                            : "border-border hover:border-primary hover:bg-accent")
                      }
                    >
                      <div>{timeFormat.format(new Date(s.startISO))}</div>
                      {eventType.capacity > 1 && (
                        <div className="mt-0.5 text-[10px] opacity-70">
                          {s.joined ? "You're in" : `${s.attendeeCount}/${eventType.capacity}`}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedISO && (
              <div className="mt-6 space-y-3 border-t pt-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the team should know?" />
                </div>
                <Button onClick={() => book.mutate()} disabled={book.isPending} className="w-full">
                  <Check className="mr-2 h-4 w-4" />
                  Confirm {timeFormat.format(new Date(selectedISO))}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}