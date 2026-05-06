import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// =============================================================================
// Wikipedia bulk import via MediaWiki API (no Firecrawl, no per-page scraping).
//
// Flow:
//   1. POST { manufacturerUrl } e.g. https://en.wikipedia.org/wiki/Porsche
//   2. Fetch the parsed page via action=parse to get the rendered HTML
//   3. Extract every internal /wiki/<Make>_... link from the model navbox /
//      "Current production" / "Production" / "Models" sections
//   4. For each model URL: fetch /api/rest_v1/page/summary/<title> in parallel
//      (gives us title, extract, originalimage thumbnail) — single fast call
//   5. AI extracts structured fields from the short summary + its own knowledge
//   6. Insert into DB (skipping URLs already imported)
// =============================================================================

const InputSchema = z.object({
  manufacturerUrl: z.string().url().refine(
    (u) => {
      try {
        const url = new URL(u);
        return url.hostname.endsWith("wikipedia.org") && url.pathname.startsWith("/wiki/");
      } catch {
        return false;
      }
    },
    { message: "Must be a Wikipedia article URL like https://en.wikipedia.org/wiki/Porsche" },
  ),
  // Hard cap to avoid runaway AI cost; "all" maps to this cap.
  maxCars: z.number().int().min(1).max(200).optional().default(150),
});

const ExtractedSchema = z.object({
  name: z.string().min(1).max(200),
  year: z.number().int().min(1900).max(2030),
  type: z.enum(["Coupé", "Sedan", "Cabriolet", "Wagon", "Hatchback"]),
  decade: z.enum(["20s", "10s", "00s", "90s", "80s", "70s", "60s", "50s"]),
  price: z.number().int().min(0),
  history: z.string().min(20).max(4000),
  difficulty_stars: z.number().int().min(1).max(5),
  reliability_stars: z.number().int().min(1).max(5),
  parts_to_find: z.enum(["easy", "medium", "hard", "extreme"]),
  cost_of_parts: z.enum(["low", "medium", "high", "extreme"]),
  mechanical_difficulty: z.enum(["easy", "medium", "hard", "extreme"]),
  electronic_difficulty: z.enum(["easy", "medium", "hard", "extreme"]),
  known_defects: z.array(z.string().min(2).max(200)).min(1).max(10),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!data) throw new Error("Admin role required");
}

// ---------------------------------------------------------------------------
// MediaWiki helpers
// ---------------------------------------------------------------------------

const UA = "ProjectGarage/1.0 (https://project-garage.lovable.app)";

type ModelLink = { title: string; url: string };

async function fetchManufacturerModels(manufacturerUrl: string): Promise<{
  makeName: string;
  models: ModelLink[];
}> {
  const url = new URL(manufacturerUrl);
  const lang = url.hostname.split(".")[0]; // e.g. "en"
  const apiBase = `https://${lang}.wikipedia.org`;
  const titleEncoded = url.pathname.slice("/wiki/".length);
  const title = decodeURIComponent(titleEncoded);
  const makeSlugLower = title.toLowerCase().split("_")[0];

  // Pull rendered HTML so we can scope to navbox / infobox sections.
  const parseUrl = `${apiBase}/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text|displaytitle&format=json&formatversion=2&origin=*`;
  const res = await fetch(parseUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`MediaWiki parse failed: ${res.status}`);
  const json = (await res.json()) as {
    parse?: { text?: string; displaytitle?: string };
    error?: { info?: string };
  };
  if (json.error) throw new Error(`MediaWiki: ${json.error.info ?? "unknown error"}`);
  const html = json.parse?.text ?? "";
  const makeName = (json.parse?.displaytitle ?? title).replace(/<[^>]+>/g, "");

  // Restrict to the model navbox / "Models" / "Current production" sections.
  // Heuristic: take the LAST navbox (manufacturer navboxes are at page bottom)
  // PLUS sections whose heading mentions Models/Production/Vehicles.
  const candidates = new Set<string>();

  // 1. Every navbox on the page (each is wrapped in <table class="navbox">…</table>)
  for (const m of html.matchAll(/<table[^>]*class="[^"]*navbox[^"]*"[^>]*>([\s\S]*?)<\/table>/g)) {
    collectModelLinks(m[1], makeSlugLower, candidates);
  }

  // 2. Any list inside sections whose heading contains Model / Production / Vehicle / Lineup
  for (const m of html.matchAll(
    /<h[23][^>]*>(?:<[^>]+>)*([^<]*?(?:Model|Production|Vehicle|Lineup|Current)[^<]*?)(?:<[^>]+>)*<\/h[23]>([\s\S]*?)(?=<h[23]|$)/gi,
  )) {
    collectModelLinks(m[2], makeSlugLower, candidates);
  }

  // 3. Fallback: if navboxes missed, scan whole page (filters still apply).
  if (candidates.size === 0) {
    collectModelLinks(html, makeSlugLower, candidates);
  }

  const models: ModelLink[] = Array.from(candidates).map((path) => ({
    title: decodeURIComponent(path.slice("/wiki/".length)),
    url: `${apiBase}${path}`,
  }));

  return { makeName, models };
}

function collectModelLinks(html: string, makeSlugLower: string, out: Set<string>) {
  // Match <a href="/wiki/...">; only article links (no ":" namespace, no "#").
  for (const m of html.matchAll(/href="(\/wiki\/[^"#?]+)"/g)) {
    const path = m[1];
    const slug = decodeURIComponent(path.slice("/wiki/".length));
    if (slug.includes(":")) continue;
    const lower = slug.toLowerCase();
    // Must reference the make and contain a model token (slug has "_")
    if (!lower.startsWith(makeSlugLower)) continue;
    if (!slug.includes("_")) continue;
    // Filter obvious non-models
    const blocked = [
      "list_of",
      "history_of",
      "_motor_company",
      "_automobile",
      "_automobiles",
      "_motors",
      "_ag",
      "_se",
      "_engine",
      "_engines",
      "_factory",
      "_museum",
      "_logo",
      "_family",
      "_concept",
      "_racing",
      "_motorsport",
      "_in_motorsport",
    ];
    if (blocked.some((b) => lower.endsWith(b) || lower.includes(b))) continue;
    out.add(path);
  }
}

type Summary = { title: string; extract: string; image?: string | null; sourceUrl: string };

async function fetchSummary(model: ModelLink): Promise<Summary | null> {
  const url = new URL(model.url);
  const apiBase = `${url.protocol}//${url.hostname}`;
  const sumUrl = `${apiBase}/api/rest_v1/page/summary/${encodeURIComponent(model.title)}`;
  try {
    const res = await fetch(sumUrl, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      title?: string;
      extract?: string;
      originalimage?: { source?: string };
      thumbnail?: { source?: string };
      type?: string;
    };
    if (j.type === "disambiguation") return null;
    if (!j.extract || j.extract.length < 40) return null;
    return {
      title: j.title ?? model.title.replace(/_/g, " "),
      extract: j.extract,
      image: j.originalimage?.source ?? j.thumbnail?.source ?? null,
      sourceUrl: model.url,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Image upload (reused pattern from cars.functions.ts)
// ---------------------------------------------------------------------------

async function uploadImage(imageUrl: string, slug: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": UA, Accept: "image/*,*/*;q=0.8" },
    });
    if (!res.ok) return imageUrl;
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png")
      ? "png"
      : ct.includes("webp")
        ? "webp"
        : ct.includes("svg")
          ? "svg"
          : "jpg";
    const buf = new Uint8Array(await res.arrayBuffer());
    const path = `${slug}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("car-images")
      .upload(path, buf, { contentType: ct, upsert: false });
    if (error) return imageUrl;
    const { data } = supabaseAdmin.storage.from("car-images").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return imageUrl;
  }
}

// ---------------------------------------------------------------------------
// AI extraction — relies heavily on model knowledge; the Wikipedia summary is
// just a short context anchor (3-5 sentences typically).
// ---------------------------------------------------------------------------

async function aiExtract(summary: Summary, makeName: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const tool = {
    type: "function" as const,
    function: {
      name: "save_car",
      description: "Extract car model fields",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          year: { type: "integer" },
          type: { type: "string", enum: ["Coupé", "Sedan", "Cabriolet", "Wagon", "Hatchback"] },
          decade: { type: "string", enum: ["20s", "10s", "00s", "90s", "80s", "70s", "60s", "50s"] },
          price: { type: "integer" },
          history: { type: "string" },
          difficulty_stars: { type: "integer", minimum: 1, maximum: 5 },
          reliability_stars: { type: "integer", minimum: 1, maximum: 5 },
          parts_to_find: { type: "string", enum: ["easy", "medium", "hard", "extreme"] },
          cost_of_parts: { type: "string", enum: ["low", "medium", "high", "extreme"] },
          mechanical_difficulty: { type: "string", enum: ["easy", "medium", "hard", "extreme"] },
          electronic_difficulty: { type: "string", enum: ["easy", "medium", "hard", "extreme"] },
          known_defects: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 10,
          },
        },
        required: [
          "name", "year", "type", "decade", "price", "history",
          "difficulty_stars", "reliability_stars", "parts_to_find", "cost_of_parts",
          "mechanical_difficulty", "electronic_difficulty", "known_defects",
        ],
        additionalProperties: false,
      },
    },
  };

  const system =
    "You are a classic-car restoration expert. Given a manufacturer and a Wikipedia summary of one of their car MODELS, " +
    "produce a structured library entry. Use your own deep knowledge to fill restoration ratings and known defects accurately. " +
    "Set price to 0 (Wikipedia has no prices). For 'year', use the year of the MOST ICONIC generation/variant of this model " +
    "(the era enthusiasts most associate with it), not necessarily the launch year. Pick 'type' based on the most iconic body style. " +
    "The 'history' field should be 2-3 paragraphs about the model's significance. Always call save_car.";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Manufacturer: ${makeName}\nModel page: ${summary.title}\nSource: ${summary.sourceUrl}\n\nWikipedia summary:\n${summary.extract}`,
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "save_car" } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached");
    if (res.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`AI extraction failed [${res.status}]: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI did not return a tool call");
  const args = JSON.parse(call.function.arguments);
  return ExtractedSchema.parse(args);
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function mapPool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------------------------------------------------------------------------
// Main server function — one call, imports everything
// ---------------------------------------------------------------------------

export const importAllFromWikipedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // 1. Discover model URLs from the manufacturer page
    const { makeName, models } = await fetchManufacturerModels(data.manufacturerUrl);
    if (models.length === 0) {
      return {
        makeName,
        discovered: 0,
        skipped: 0,
        imported: 0,
        failed: 0,
        results: [] as Array<{ url: string; ok: boolean; name?: string; slug?: string; error?: string }>,
      };
    }

    // 2. De-dupe against already imported source_urls
    const allUrls = models.map((m) => m.url);
    const { data: existing } = await supabaseAdmin
      .from("cars")
      .select("source_url")
      .in("source_url", allUrls);
    const already = new Set((existing ?? []).map((r) => r.source_url));
    const fresh = models.filter((m) => !already.has(m.url)).slice(0, data.maxCars);

    if (fresh.length === 0) {
      return {
        makeName,
        discovered: models.length,
        skipped: models.length,
        imported: 0,
        failed: 0,
        results: [],
      };
    }

    // 3. Fetch summaries in parallel (10 at a time — Wikipedia REST is fast)
    const summaries = await mapPool(fresh, 10, fetchSummary);

    // 4. For each summary: AI extract → upload image → insert. Limit to 4
    //    concurrent AI calls to stay polite to the gateway.
    const results: Array<{ url: string; ok: boolean; name?: string; slug?: string; error?: string }> = [];
    const usedSlugs = new Set<string>();

    await mapPool(summaries, 4, async (sum) => {
      if (!sum) {
        results.push({ url: "(unknown)", ok: false, error: "no summary" });
        return;
      }
      try {
        const extracted = await aiExtract(sum, makeName);
        const baseSlug = slugify(`${extracted.name}-${extracted.year}`);
        let slug = baseSlug;
        let n = 1;
        // local + DB de-dup
        while (usedSlugs.has(slug)) {
          n += 1;
          slug = `${baseSlug}-${n}`;
        }
        // also check DB (in case prior import used the same slug)
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data: exists } = await supabaseAdmin
            .from("cars")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          if (!exists) break;
          n += 1;
          slug = `${baseSlug}-${n}`;
        }
        usedSlugs.add(slug);

        const imageUrl = sum.image ? await uploadImage(sum.image, slug) : null;

        const { error: insertErr } = await supabaseAdmin.from("cars").insert({
          slug,
          name: extracted.name,
          make: makeName,
          year: extracted.year,
          type: extracted.type,
          decade: extracted.decade,
          price: extracted.price,
          history: extracted.history,
          difficulty_stars: extracted.difficulty_stars,
          reliability_stars: extracted.reliability_stars,
          parts_to_find: extracted.parts_to_find,
          cost_of_parts: extracted.cost_of_parts,
          mechanical_difficulty: extracted.mechanical_difficulty,
          electronic_difficulty: extracted.electronic_difficulty,
          known_defects: extracted.known_defects,
          image_url: imageUrl,
          source_url: sum.sourceUrl,
        });
        if (insertErr) throw new Error(insertErr.message);
        results.push({ url: sum.sourceUrl, ok: true, name: extracted.name, slug });
      } catch (e) {
        results.push({
          url: sum.sourceUrl,
          ok: false,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    });

    const imported = results.filter((r) => r.ok).length;
    return {
      makeName,
      discovered: models.length,
      skipped: models.length - fresh.length,
      imported,
      failed: results.length - imported,
      results,
    };
  });
