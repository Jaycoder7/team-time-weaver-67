import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listEventTypes } from "@/lib/event-types.functions";
import { getMe } from "@/lib/session.functions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
      } else {
        setAuthed(true);
      }
    });
  }, [navigate]);

  const meFn = useServerFn(getMe);
  const listFn = useServerFn(listEventTypes);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn(), enabled: !!authed });
  const events = useQuery({ queryKey: ["event-types"], queryFn: () => listFn(), enabled: !!authed });

  if (!authed) return null;

  const active = (events.data ?? []).filter((e) => e.active);

  return (
    <AppShell isOwner={me.data?.isOwner} email={me.data?.profile?.email}>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Book time with the team</h1>
        <p className="mt-2 text-muted-foreground">Pick an event type to see open slots.</p>
      </div>

      {events.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : active.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No event types yet</CardTitle>
            <CardDescription>
              {me.data?.isOwner
                ? "Create your first event type in Admin to start accepting bookings."
                : "The team owner hasn't set up any bookable slots yet."}
            </CardDescription>
          </CardHeader>
          {me.data?.isOwner && (
            <CardContent>
              <Button asChild>
                <Link to="/admin/event-types">Go to admin</Link>
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((et) => (
            <Link
              key={et.id}
              to="/book/$slug"
              params={{ slug: et.slug }}
              className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: et.color }}
                />
                <h3 className="font-semibold">{et.title}</h3>
              </div>
              {et.description && (
                <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{et.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" /> {et.duration_min} min
                </Badge>
                {et.capacity > 1 && (
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" /> up to {et.capacity}
                  </Badge>
                )}
                <span className="ml-auto text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Book <ArrowRight className="ml-1 inline h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
