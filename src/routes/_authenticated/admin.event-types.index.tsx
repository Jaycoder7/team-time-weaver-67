import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listEventTypes, deleteEventType, upsertEventType } from "@/lib/event-types.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Users, Clock, Pencil, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/event-types/")({
  component: EventTypesList,
});

function EventTypesList() {
  const listFn = useServerFn(listEventTypes);
  const delFn = useServerFn(deleteEventType);
  const upFn = useServerFn(upsertEventType);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["event-types"], queryFn: () => listFn() });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["event-types"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (et: { id: string; active: boolean; title: string; slug: string; duration_min: number; capacity: number; buffer_before_min: number; buffer_after_min: number; min_notice_hours: number; max_days_ahead: number; color: string; description: string | null }) =>
      upFn({ data: { ...et, description: et.description ?? undefined, active: !et.active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-types"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button asChild>
          <Link to="/admin/event-types/$id" params={{ id: "new" }}>
            <Plus className="mr-1 h-4 w-4" /> New event type
          </Link>
        </Button>
      </div>

      {q.data?.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          No event types yet. Create one to start accepting bookings.
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {(q.data ?? []).map((et) => (
          <Card key={et.id}>
            <CardContent className="flex flex-wrap items-center gap-3 py-4">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: et.color }} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{et.title}</div>
                <div className="text-xs text-muted-foreground">/book/{et.slug}</div>
              </div>
              <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> {et.duration_min}m</Badge>
              {et.capacity > 1 && (
                <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> {et.capacity}</Badge>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{et.active ? "Active" : "Off"}</span>
                <Switch checked={et.active} onCheckedChange={() => toggle.mutate(et)} />
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/event-types/$id" params={{ id: et.id }}><Pencil className="h-3 w-3" /></Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                if (confirm(`Delete "${et.title}"? This also removes its bookings.`)) del.mutate(et.id);
              }}>
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="Copy share link"
                onClick={async () => {
                  const url = `${window.location.origin}/book/${et.slug}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("Share link copied");
                  } catch {
                    toast.error(url);
                  }
                }}
              >
                <LinkIcon className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}