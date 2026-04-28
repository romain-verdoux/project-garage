import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Car, CarType, Decade, Difficulty, CostLevel } from "@/data/cars";
import fallbackImg from "@/assets/hero-garage.jpg";

type CarRow = {
  id: string;
  slug: string;
  name: string;
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

export const listCars = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("cars")
    .select(CAR_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Failed to load cars: ${error.message}`);
  return (data as CarRow[]).map(rowToCar);
});

export const getCarBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("cars")
      .select(CAR_COLUMNS)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(`Failed to load car: ${error.message}`);
    if (!row) return null;
    return rowToCar(row as CarRow);
  });
