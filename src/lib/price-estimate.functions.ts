import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!data) throw new Error("Admin role required");
}

export const countMissingPrices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ remaining: number }> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("cars")
      .select("id", { count: "exact", head: true })
      .eq("price", 0);
    if (error) throw new Error(`Count failed: ${error.message}`);
    return { remaining: count ?? 0 };
  });

type CarToPrice = { id: string; name: string; make: string; year: number };

async function estimateBatch(cars: CarToPrice[]): Promise<Record<string, number>> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const tool = {
    type: "function" as const,
    function: {
      name: "save_prices",
      description: "Return estimated current USD market values for each car",
      parameters: {
        type: "object",
        properties: {
          estimates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                price_usd: {
                  type: "integer",
                  description:
                    "Best-guess current market value in USD for a driver-quality example of this car. Use 0 only if completely unknown.",
                },
              },
              required: ["id", "price_usd"],
              additionalProperties: false,
            },
          },
        },
        required: ["estimates"],
        additionalProperties: false,
      },
    },
  };

  const list = cars
    .map((c) => `- id=${c.id} | ${c.year} ${c.make} ${c.name}`)
    .join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a classic and collector car market expert. Estimate the current US market value (USD) for a driver-quality, average-condition example of each car. Base estimates on auction results, Hagerty valuations, and dealer asking prices you are aware of. Return integer USD values, no currency symbols. If you truly have no idea, return 0.",
        },
        {
          role: "user",
          content: `Estimate the current market value (USD) for each of these cars. Return one entry per id.\n\n${list}`,
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "save_prices" } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Please wait and try again.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
    throw new Error(`AI estimate failed [${res.status}]: ${body}`);
  }

  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI did not return a tool call");
  const args = JSON.parse(call.function.arguments);
  const parsed = z
    .object({
      estimates: z.array(
        z.object({ id: z.string(), price_usd: z.number().int().min(0).max(50_000_000) }),
      ),
    })
    .parse(args);

  const out: Record<string, number> = {};
  for (const e of parsed.estimates) out[e.id] = e.price_usd;
  return out;
}

export const estimateMissingPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ batchSize: z.number().int().min(1).max(50) }).parse(data),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ processed: number; succeeded: number; remaining: number }> => {
      await assertAdmin(context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: rows, error } = await supabaseAdmin
        .from("cars")
        .select("id,name,make,year")
        .eq("price", 0)
        .limit(data.batchSize);
      if (error) throw new Error(`Failed to load cars: ${error.message}`);
      if (!rows || rows.length === 0) {
        return { processed: 0, succeeded: 0, remaining: 0 };
      }

      const estimates = await estimateBatch(rows as CarToPrice[]);

      let succeeded = 0;
      await Promise.all(
        rows.map(async (r) => {
          const price = estimates[r.id];
          if (typeof price !== "number" || price <= 0) return;
          const { error: upErr } = await supabaseAdmin
            .from("cars")
            .update({ price })
            .eq("id", r.id);
          if (!upErr) succeeded += 1;
        }),
      );

      const { count } = await supabaseAdmin
        .from("cars")
        .select("id", { count: "exact", head: true })
        .eq("price", 0);

      return { processed: rows.length, succeeded, remaining: count ?? 0 };
    },
  );
