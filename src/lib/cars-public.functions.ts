import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// supabaseAdmin is imported dynamically inside each handler so this file
// stays free of top-level server-only imports (client-reachable via routes).
import type { Car, CarType, Decade, Difficulty, CostLevel } from "@/data/cars";
import fallbackImg from "@/assets/hero-garage.jpg";

type CarRow = {
  id: string;
  slug: string;
  name: string;
  make: string;
  image_url: string | null;
  type: string;
  price: number;
  year: number;
  decade: string;
  history: string;
  difficulty_stars: number;
  parts_to_find: string;
  cost_of_parts: string;
  reliability_stars: number;
  mechanical_difficulty: string;
  electronic_difficulty: string;
  known_defects: string[] | null;
};

function rowToCar(row: CarRow): Car {
  return {
    id: row.slug,
    name: row.name,
    make: row.make || row.name.split(" ")[0],
    image: row.image_url || fallbackImg,
    type: row.type as CarType,
    price: row.price,
    year: row.year,
    decade: row.decade as Decade,
    history: row.history,
    difficultyStars: Math.min(5, Math.max(1, row.difficulty_stars)) as Car["difficultyStars"],
    partsToFind: row.parts_to_find as Difficulty,
    costOfParts: row.cost_of_parts as CostLevel,
    reliabilityStars: Math.min(5, Math.max(1, row.reliability_stars)) as Car["reliabilityStars"],
    mechanicalDifficulty: row.mechanical_difficulty as Difficulty,
    electronicDifficulty: row.electronic_difficulty as Difficulty,
    knownDefects: row.known_defects ?? [],
  };
}

const CAR_COLUMNS =
  "id,slug,name,make,image_url,type,price,year,decade,history,difficulty_stars,parts_to_find,cost_of_parts,reliability_stars,mechanical_difficulty,electronic_difficulty,known_defects";

export const listCars = createServerFn({ method: "GET" }).handler(async (): Promise<Car[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("cars")
    .select(CAR_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Failed to load cars: ${error.message}`);
  return (data as unknown as CarRow[]).map(rowToCar);
});

const PRICE_RANGES: Record<string, { min: number; max: number }> = {
  u10: { min: 0, max: 10_000 },
  "10-25": { min: 10_000, max: 25_000 },
  "25-50": { min: 25_000, max: 50_000 },
  "50-100": { min: 50_000, max: 100_000 },
  a100: { min: 100_000, max: 1_000_000_000 },
};

export const listCarsPage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        offset: z.number().int().min(0),
        limit: z.number().int().min(1).max(200),
        makes: z.array(z.string()).optional().default([]),
        types: z.array(z.string()).optional().default([]),
        decades: z.array(z.string()).optional().default([]),
        prices: z.array(z.string()).optional().default([]),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ cars: Car[]; total: number }> => {
    const { offset, limit, makes, types, decades, prices } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("cars")
      .select(CAR_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (makes.length) q = q.in("make", makes);
    if (types.length) q = q.in("type", types as any);
    if (decades.length) q = q.in("decade", decades as any);
    if (prices.length) {
      const parts = prices
        .map((p) => PRICE_RANGES[p])
        .filter(Boolean)
        .map((r) => `and(price.gte.${r.min},price.lt.${r.max})`);
      if (parts.length) q = q.or(parts.join(","));
    }
    const { data: rows, error, count } = await q;
    if (error) throw new Error(`Failed to load cars: ${error.message}`);
    return {
      cars: (rows as unknown as CarRow[]).map(rowToCar),
      total: count ?? 0,
    };
  });

export const listCarFacets = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ makes: string[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Loop in pages of 1000 to gather all distinct makes (bypasses PostgREST cap).
    const makes = new Set<string>();
    const PAGE = 1000;
    for (let from = 0; from < 100_000; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from("cars")
        .select("make")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Failed to load facets: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const r of data as { make: string | null }[]) {
        if (r.make) makes.add(r.make);
      }
      if (data.length < PAGE) break;
    }
    return { makes: Array.from(makes).sort() };
  },
);

export const updateCarField = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        field: z.enum(["name", "make", "type", "price", "year", "decade"]),
        value: z.union([z.string(), z.number()]),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cars")
      .update({ [data.field]: data.value } as any)
      .eq("id", data.id);
    if (error) throw new Error(`Failed to update car: ${error.message}`);
    return { ok: true };
  });

export const deleteCarById = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("cars").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to delete car: ${error.message}`);
    return { ok: true };
  });

export const deleteCarBySlug = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("cars").delete().eq("slug", data.slug);
    if (error) throw new Error(`Failed to delete car: ${error.message}`);
    return { ok: true };
  });

export type AdminCar = {
  id: string;
  name: string;
  make: string;
  type: string;
  price: number;
  year: number;
  decade: string;
  image_url: string | null;
};

export const listCarsAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminCar[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Page through results to bypass the 1000-row PostgREST cap so the admin
    // table reflects every car (matches what the backfill counters see).
    const all: AdminCar[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 100_000; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from("cars")
        .select("id,name,make,type,price,year,decade,image_url")
        .order("name", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Failed to load cars: ${error.message}`);
      const rows = (data ?? []) as AdminCar[];
      all.push(...rows);
      if (rows.length < PAGE) break;
    }
    return all;
  },
);

export const getCarBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<Car | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("cars")
      .select(CAR_COLUMNS)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(`Failed to load car: ${error.message}`);
    if (!row) return null;
    return rowToCar(row as unknown as CarRow);
  });
