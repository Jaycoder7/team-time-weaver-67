import { createFileRoute, Link, Outlet, useLocation, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMe, getGoogleCalendarStatus } from "@/lib/session.functions";
import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const meFn = useServerFn(getMe);
  const gcalFn = useServerFn(getGoogleCalendarStatus);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const gcal = useQuery({ queryKey: ["gcal-status"], queryFn: () => gcalFn() });
  const loc = useLocation();

  if (me.isLoading) {
    return <AppShell><p>Loading…</p></AppShell>;
  }
  if (me.data && !me.data.isOwner) {
    throw redirect({ to: "/" });
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
          <AlertTitle>Google Calendar not connected</AlertTitle>
          <AlertDescription>
            Bookings will still work, but the app won't check your calendar for conflicts or create
            calendar events. Connect Google Calendar via the connectors panel to enable sync.
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