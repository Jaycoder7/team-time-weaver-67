import { createFileRoute, Link, Outlet, useLocation, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMe, getGoogleCalendarStatus } from "@/lib/session.functions";
import {
  startGoogleCalendarConnect,
  saveGoogleCalendarConnection,
  disconnectGoogleCalendar,
} from "@/lib/google-connect.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const meFn = useServerFn(getMe);
  const gcalFn = useServerFn(getGoogleCalendarStatus);
  const startFn = useServerFn(startGoogleCalendarConnect);
  const saveFn = useServerFn(saveGoogleCalendarConnection);
  const disconnectFn = useServerFn(disconnectGoogleCalendar);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const gcal = useQuery({ queryKey: ["gcal-status"], queryFn: () => gcalFn() });
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loc = useLocation();

  if (me.isLoading) {
    return <AppShell><p>Loading…</p></AppShell>;
  }
  if (me.data && !me.data.isOwner) {
    throw redirect({ to: "/" });
  }

  async function onConnect() {
    setBusy(true);
    setError(null);
    try {
      const result = await connectAppUser({
        connectorId: "google_calendar",
        gatewayBaseUrl: GATEWAY_BASE_URL,
        start: (targetOrigin) => startFn({ data: targetOrigin }),
      });
      if (!result.success) {
        setError(result.error ?? "Failed to connect");
      } else if (result.connectionAPIKey) {
        await saveFn({ data: { connectionAPIKey: result.connectionAPIKey } });
        await qc.invalidateQueries({ queryKey: ["gcal-status"] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    setBusy(true);
    try {
      await disconnectFn();
      await qc.invalidateQueries({ queryKey: ["gcal-status"] });
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { to: "/admin/event-types", label: "Event types" },
    { to: "/admin/availability", label: "Availability" },
    { to: "/admin/bookings", label: "Bookings" },
  ] as const;

  return (
    <AppShell isOwner={me.data?.isOwner} email={me.data?.profile?.email}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">Manage your team's bookable slots.</p>
      </div>

      {gcal.data && !gcal.data.connected && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connect your Google Calendar</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              Bookings work without it, but connecting lets us check your calendar for conflicts
              and create events for each booking.
            </span>
            {error && <span className="text-destructive text-sm">{error}</span>}
            <div>
              <Button size="sm" onClick={onConnect} disabled={busy}>
                {busy ? "Connecting…" : "Connect Google Calendar"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      {gcal.data?.connected && (
        <Alert className="mb-6">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Google Calendar connected</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>Your calendar is being used for availability and event creation.</span>
            <Button size="sm" variant="outline" onClick={onDisconnect} disabled={busy}>
              Disconnect
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = loc.pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={
                "border-b-2 px-3 py-2 text-sm transition-colors " +
                (active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </AppShell>
  );
}