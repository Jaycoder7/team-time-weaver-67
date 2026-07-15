import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listEventTypes, upsertEventType } from "@/lib/event-types.functions";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/event-types/$id")({
  component: EventTypeEditor,
});

const empty = {
  title: "",
  slug: "",
  description: "",
  duration_min: 30,
  capacity: 1,
  buffer_before_min: 0,
  buffer_after_min: 0,
  min_notice_hours: 4,
  max_days_ahead: 30,
  color: "#0ea5e9",
  active: true,
};

function EventTypeEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listEventTypes);
  const upFn = useServerFn(upsertEventType);

  const q = useQuery({ queryKey: ["event-types"], queryFn: () => listFn(), enabled: !isNew });
  const existing = !isNew ? q.data?.find((e) => e.id === id) : undefined;

  const [form, setForm] = useState(empty);
  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title,
        slug: existing.slug,
        description: existing.description ?? "",
        duration_min: existing.duration_min,
        capacity: existing.capacity,
        buffer_before_min: existing.buffer_before_min,
        buffer_after_min: existing.buffer_after_min,
        min_notice_hours: existing.min_notice_hours,
        max_days_ahead: existing.max_days_ahead,
        color: existing.color,
        active: existing.active,
      });
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => upFn({
      data: {
        ...form,
        id: isNew ? undefined : id,
        description: form.description || undefined,
      },
    }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["event-types"] });
      navigate({ to: "/admin/event-types" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/admin/event-types"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
      </Button>
      <Card>
        <CardContent className="space-y-4 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="30 min chat" />
            </div>
            <div>
              <Label>URL slug</Label>
              <Input value={form.slug} onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="chat" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Duration (min)" value={form.duration_min} onChange={(v) => update("duration_min", v)} min={5} />
            <Field label="Capacity" value={form.capacity} onChange={(v) => update("capacity", v)} min={1} hint="How many people can join the same slot? >1 = group booking." />
            <div>
              <Label>Color</Label>
              <Input type="color" value={form.color} onChange={(e) => update("color", e.target.value)} className="h-10 p-1" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Buffer before (min)" value={form.buffer_before_min} onChange={(v) => update("buffer_before_min", v)} />
            <Field label="Buffer after (min)" value={form.buffer_after_min} onChange={(v) => update("buffer_after_min", v)} />
            <Field label="Min notice (hours)" value={form.min_notice_hours} onChange={(v) => update("min_notice_hours", v)} />
            <Field label="Max days ahead" value={form.max_days_ahead} onChange={(v) => update("max_days_ahead", v)} min={1} />
          </div>
          <div className="flex items-center gap-3 border-t pt-4">
            <Switch checked={form.active} onCheckedChange={(v) => update("active", v)} />
            <Label>Active — teammates can book this</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild><Link to="/admin/event-types">Cancel</Link></Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, min, hint }: { label: string; value: number; onChange: (v: number) => void; min?: number; hint?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" min={min ?? 0} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}