import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getPublicEventType,
  getPublicSlots,
  createPublicBooking,
} from "@/lib/booking-public.functions";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Users, Check, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/book/$slug")({
  ssr: false,
  component: BookPage,
  head: ({ params }) => ({
    meta: [
      { title: `Book time — ${params.slug}` },
      { name: "description", content: "Pick a time that works for you." },
    ],
  }),
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
  const getEtFn = useServerFn(getPublicEventType);
  const getSlotsFn = useServerFn(getPublicSlots);
  const createFn = useServerFn(createPublicBooking);

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail((cur) => cur || data.user!.email || "");
        const meta = data.user!.user_metadata as { full_name?: string; name?: string };
        setName((cur) => cur || meta?.full_name || meta?.name || "");
      }
    });
  }, []);

  const et = useQuery({
    queryKey: ["public-event-type", slug],
    queryFn: () => getEtFn({ data: { slug } }),
  });

  const dateISO = date ? toDateISO(date) : null;
  const slots = useQuery({
    queryKey: ["public-slots", et.data?.id, dateISO],
    queryFn: () => getSlotsFn({ data: { eventTypeId: et.data!.id, dateISO: dateISO! } }),
    enabled: !!et.data && !!dateISO,
  });

  const book = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          eventTypeId: et.data!.id,
          startISO: selectedISO!,
          name: name.trim(),
          email: email.trim(),
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Booked! Check your inbox for the calendar invite.");
      setConfirmed(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }),
    [],
  );

  if (et.isLoading) {
    return <PublicShell><p className="text-muted-foreground">Loading…</p></PublicShell>;
  }
  if (!et.data) {
    return (
      <PublicShell>
        <p className="text-muted-foreground">This booking link isn't available.</p>
      </PublicShell>
    );
  }

  if (confirmed && selectedISO) {
    return (
      <PublicShell>
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">You're booked</h1>
            <p className="text-muted-foreground">
              {new Date(selectedISO).toLocaleString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <Button variant="outline" onClick={() => { setConfirmed(false); setSelectedISO(null); }}>
              Book another time
            </Button>
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  const eventType = et.data;
  const canSubmit = !!selectedISO && name.trim().length > 0 && /.+@.+\..+/.test(email.trim());

  return (
    <PublicShell>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate({ to: "/" })}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Home
      </Button>

      <div className="mb-8 flex items-start gap-3">
        <span className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: eventType.color }} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{eventType.title}</h1>
          {eventType.description && (
            <p className="mt-1 text-muted-foreground">{eventType.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
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
                  const disabled = s.full;
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
                          {s.full ? "Full" : `${s.attendeeCount}/${eventType.capacity}`}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedISO && (
              <div className="mt-6 space-y-3 border-t pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Your name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the team should know?" />
                </div>
                <Button onClick={() => book.mutate()} disabled={book.isPending || !canSubmit} className="w-full">
                  <Check className="mr-2 h-4 w-4" />
                  Confirm {timeFormat.format(new Date(selectedISO))}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" /> Booking
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}