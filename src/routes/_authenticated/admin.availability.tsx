import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAvailabilityRules, replaceAvailability } from "@/lib/event-types.functions";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/availability")({
  component: AvailabilityPage,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Rule { weekday: number; start_time: string; end_time: string }

function AvailabilityPage() {
  const listFn = useServerFn(listAvailabilityRules);
  const saveFn = useServerFn(replaceAvailability);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["availability"], queryFn: () => listFn() });
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    if (q.data) {
      setRules(q.data.map((r) => ({
        weekday: r.weekday,
        start_time: r.start_time.slice(0, 5),
        end_time: r.end_time.slice(0, 5),
      })));
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => saveFn({ data: { rules } }),
    onSuccess: () => {
      toast.success("Availability saved");
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFor = (weekday: number) =>
    setRules((r) => [...r, { weekday, start_time: "09:00", end_time: "17:00" }]);
  const remove = (idx: number) => setRules((r) => r.filter((_, i) => i !== idx));
  const update = (idx: number, patch: Partial<Rule>) =>
    setRules((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  return (
    <div>
      <Card>
        <CardContent className="py-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Weekly hours you're available. Times use your profile timezone.
          </p>
          <div className="space-y-4">
            {DAYS.map((day, idx) => {
              const dayRules = rules
                .map((r, i) => ({ ...r, i }))
                .filter((r) => r.weekday === idx);
              return (
                <div key={day} className="flex flex-wrap items-start gap-3 border-b border-border pb-4">
                  <div className="w-24 shrink-0 pt-2 text-sm font-medium">{day}</div>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {dayRules.length === 0 && (
                      <span className="pt-2 text-sm text-muted-foreground">Unavailable</span>
                    )}
                    {dayRules.map((r) => (
                      <div key={r.i} className="flex items-center gap-1">
                        <Input
                          type="time"
                          className="w-28"
                          value={r.start_time}
                          onChange={(e) => update(r.i, { start_time: e.target.value })}
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          type="time"
                          className="w-28"
                          value={r.end_time}
                          onChange={(e) => update(r.i, { end_time: e.target.value })}
                        />
                        <Button variant="ghost" size="icon" onClick={() => remove(r.i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => addFor(idx)}>
                    <Plus className="mr-1 h-3 w-3" /> Add
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save availability</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}