import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
  "id,slug,name,image_url,type,price,year,decade,history,difficulty_stars,parts_to_find,cost_of_parts,reliability_stars,mechanical_difficulty,electronic_difficulty,known_defects";

export const listCars = createServerFn({ method: "GET" }).handler(async (): Promise<Car[]> => {
  const { data, error } = await supabaseAdmin
    .from("cars")
    .select(CAR_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Failed to load cars: ${error.message}`);
  return (data as unknown as CarRow[]).map(rowToCar);
});

export const listCarsPage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ offset: z.number().int().min(0), limit: z.number().int().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }): Promise<Car[]> => {
    const { offset, limit } = data;
    const { data: rows, error } = await supabaseAdmin
      .from("cars")
      .select(CAR_COLUMNS)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Failed to load cars: ${error.message}`);
    return (rows as unknown as CarRow[]).map(rowToCar);
  });

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
    const { error } = await supabaseAdmin.from("cars").delete().eq("id", data.id);
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
};

export const listCarsAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminCar[]> => {
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("id,name,make,type,price,year,decade")
      .order("name", { ascending: true })
      .limit(2000);
    if (error) throw new Error(`Failed to load cars: ${error.message}`);
    return data as AdminCar[];
  },
);

export const getCarBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<Car | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("cars")
      .select(CAR_COLUMNS)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(`Failed to load car: ${error.message}`);
    if (!row) return null;
    return rowToCar(row as unknown as CarRow);
  });
