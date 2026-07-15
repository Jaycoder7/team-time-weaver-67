import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listEventTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("event_types")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getEventTypeBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("event_types")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "lowercase, digits and dashes only"),
  description: z.string().optional().nullable(),
  duration_min: z.number().int().min(5).max(480),
  capacity: z.number().int().min(1).max(1000),
  buffer_before_min: z.number().int().min(0).max(240),
  buffer_after_min: z.number().int().min(0).max(240),
  min_notice_hours: z.number().int().min(0).max(720),
  max_days_ahead: z.number().int().min(1).max(365),
  color: z.string().default("#0ea5e9"),
  active: z.boolean().default(true),
});

export const upsertEventType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const row = { ...data, owner_id: context.userId };
    const { data: saved, error } = data.id
      ? await context.supabase.from("event_types").update(row).eq("id", data.id).select().single()
      : await context.supabase.from("event_types").insert(row).select().single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteEventType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("event_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAvailabilityRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("availability_rules")
      .select("*")
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const availabilitySchema = z.object({
  rules: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      start_time: z.string(),
      end_time: z.string(),
    }),
  ),
});

export const replaceAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => availabilitySchema.parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase.from("availability_rules").delete().eq("owner_id", context.userId);
    if (data.rules.length > 0) {
      const rows = data.rules.map((r) => ({ ...r, owner_id: context.userId }));
      const { error } = await context.supabase.from("availability_rules").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });