import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Firecrawl from "@mendable/firecrawl-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  url: z.string().url().refine((u) => u.includes("classicdriver.com"), {
    message: "URL must be from classicdriver.com",
  }),
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

async function uploadImage(imageUrl: string, slug: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const buf = new Uint8Array(await res.arrayBuffer());
    const path = `${slug}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("car-images")
      .upload(path, buf, { contentType: ct, upsert: false });
    if (error) {
      console.error("Image upload failed:", error);
      return imageUrl;
    }
    const { data } = supabaseAdmin.storage.from("car-images").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("Image fetch failed:", e);
    return imageUrl;
  }
}

async function aiExtract(markdown: string, sourceUrl: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const tool = {
    type: "function" as const,
    function: {
      name: "save_car",
      description: "Extract car listing fields from scraped content",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Make + model + variant, e.g. 'Ford Mustang Fastback'" },
          year: { type: "integer" },
          type: { type: "string", enum: ["Coupé", "Sedan", "Cabriolet", "Wagon", "Hatchback"] },
          decade: { type: "string", enum: ["20s", "10s", "00s", "90s", "80s", "70s", "60s", "50s"] },
          price: { type: "integer", description: "Price in USD; if EUR/GBP convert roughly; 0 if unknown" },
          history: { type: "string", description: "2-4 paragraph history of the model (not this specific car)" },
          difficulty_stars: { type: "integer", minimum: 1, maximum: 5, description: "Overall restoration difficulty" },
          reliability_stars: { type: "integer", minimum: 1, maximum: 5 },
          parts_to_find: { type: "string", enum: ["easy", "medium", "hard", "extreme"] },
          cost_of_parts: { type: "string", enum: ["low", "medium", "high", "extreme"] },
          mechanical_difficulty: { type: "string", enum: ["easy", "medium", "hard", "extreme"] },
          electronic_difficulty: { type: "string", enum: ["easy", "medium", "hard", "extreme"] },
          known_defects: {
            type: "array",
            items: { type: "string" },
            description: "3-6 well-known model-wide defects/weaknesses",
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

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a classic-car expert. Extract a car listing from scraped content. " +
            "Use your knowledge of the model to fill the rank fields and known defects accurately. " +
            "Be concise and factual. Always call the save_car tool.",
        },
        {
          role: "user",
          content: `Source URL: ${sourceUrl}\n\nScraped content:\n\n${markdown.slice(0, 12000)}`,
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "save_car" } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Please wait and try again.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
    throw new Error(`AI extraction failed [${res.status}]: ${body}`);
  }

  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI did not return a tool call");
  const args = JSON.parse(call.function.arguments);
  return ExtractedSchema.parse(args);
}

async function assertAdmin(userId: string) {
  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleErr) throw new Error(`Role check failed: ${roleErr.message}`);
  if (!roleRow) throw new Error("Admin role required");
}

const MAX_DISCOVERY = 50;

const DiscoverInputSchema = z.object({
  url: z.string().url().refine((u) => u.includes("classicdriver.com"), {
    message: "URL must be from classicdriver.com",
  }),
  limit: z.number().int().min(1).max(MAX_DISCOVERY).optional().default(20),
});

// Match individual car detail pages on Classic Driver.
// Examples:
//   https://www.classicdriver.com/en/car/ford/mustang/1967/123456
//   https://www.classicdriver.com/de/auto/porsche/911/1973/987654
function isCarDetailUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (!url.hostname.includes("classicdriver.com")) return false;
    // path like /<lang>/(car|auto|voiture|automobile)/<make>/<model>/<year>/<id>
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 6) return false;
    const segment = parts[1]?.toLowerCase();
    if (!["car", "auto", "voiture", "automobile"].includes(segment)) return false;
    const last = parts[parts.length - 1];
    return /^\d{3,}$/.test(last);
  } catch {
    return false;
  }
}

export const discoverCarUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DiscoverInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");

    const fc = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });
    // Classic Driver search/listing pages are client-rendered, so `map` returns
    // almost nothing useful. Use `scrape` with the `links` format + waitFor so
    // the JS-rendered car cards are present when links are extracted.
    const result = await fc.scrape(data.url, {
      formats: ["links"],
      onlyMainContent: false,
      waitFor: 5000,
    });

    const rawLinks: unknown =
      (result as { links?: unknown }).links ??
      (result as { data?: { links?: unknown } }).data?.links ??
      [];
    const links: string[] = Array.isArray(rawLinks)
      ? rawLinks
          .map((l) => (typeof l === "string" ? l : (l as { url?: string })?.url))
          .filter((u): u is string => typeof u === "string")
      : [];

    const carUrls = Array.from(new Set(links.filter(isCarDetailUrl)));

    // Filter out URLs already imported
    const { data: existing } = await supabaseAdmin
      .from("cars")
      .select("source_url")
      .in("source_url", carUrls);
    const already = new Set((existing ?? []).map((r) => r.source_url));
    const fresh = carUrls.filter((u) => !already.has(u));

    return {
      total: carUrls.length,
      alreadyImported: carUrls.length - fresh.length,
      urls: fresh.slice(0, data.limit),
    };
  });

const ScrapeOneInputSchema = z.object({
  url: z.string().url().refine((u) => u.includes("classicdriver.com")),
});

async function scrapeOne(url: string) {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");

  const fc = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });
  const scraped = await fc.scrape(url, {
    formats: ["markdown"],
    onlyMainContent: true,
  });

  const markdown =
    (scraped as { markdown?: string }).markdown ??
    (scraped as { data?: { markdown?: string } }).data?.markdown ??
    "";
  const metadata =
    (scraped as { metadata?: Record<string, unknown> }).metadata ??
    (scraped as { data?: { metadata?: Record<string, unknown> } }).data?.metadata ??
    {};

  if (!markdown || markdown.length < 100) {
    throw new Error("Scraped page is empty or too short");
  }

  // Classic Driver exposes the hero image via og:image. The Firecrawl SDK
  // returns metadata with the literal key "og:image" (with the colon), and
  // sometimes also as ogImage — check both, then fall back to the first
  // non-data image found in the markdown.
  let sourceImage: string | null =
    (metadata["og:image"] as string | undefined) ??
    (metadata.ogImage as string | undefined) ??
    (metadata["twitter:image"] as string | undefined) ??
    (metadata.twitterImage as string | undefined) ??
    null;

  if (!sourceImage) {
    const mdImg = [...markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)]
      .map((m) => m[1])
      .find((u) => !u.includes("Base64") && !u.startsWith("data:"));
    sourceImage = mdImg ?? null;
  }
  console.log("[scrapeOne] sourceImage:", sourceImage);

  const extracted = await aiExtract(markdown, url);

  const baseSlug = slugify(`${extracted.name}-${extracted.year}`);
  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const { data: exists } = await supabaseAdmin
      .from("cars")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!exists) break;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const imageUrl = sourceImage ? await uploadImage(sourceImage, slug) : null;

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("cars")
    .insert({
      slug,
      name: extracted.name,
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
      source_url: url,
    })
    .select()
    .single();

  if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`);
  return inserted;
}

const ScrapeManyInputSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(MAX_DISCOVERY),
});

export const scrapeManyCars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScrapeManyInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const results: Array<{ url: string; ok: boolean; name?: string; slug?: string; error?: string }> = [];
    // Sequential to avoid Firecrawl/AI rate limits
    for (const url of data.urls) {
      try {
        const car = await scrapeOne(url);
        results.push({ url, ok: true, name: car.name, slug: car.slug });
      } catch (e) {
        results.push({ url, ok: false, error: e instanceof Error ? e.message : "Unknown error" });
      }
    }
    return { results };
  });

export const scrapeCarFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const car = await scrapeOne(data.url);
    return { car };
  });

