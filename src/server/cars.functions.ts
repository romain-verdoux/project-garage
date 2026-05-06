import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Firecrawl from "@mendable/firecrawl-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// =============================================================================
// Per-site registry
// =============================================================================
// Each site declares:
//   - hostMatch: substring(s) the URL must contain to be accepted
//   - isDetailUrl: predicate identifying a single car/model detail page
//   - discover: how to extract child detail URLs from a "parent" page
//   - extractionHint: extra guidance appended to the AI system prompt
// Adding a new source = add a new entry below.

type SiteAdapter = {
  id: string;
  hostMatch: string[];
  isDetailUrl: (url: string) => boolean;
  // Optional: a custom discovery routine. Defaults to "scrape page, collect
  // links, filter through isDetailUrl".
  discover?: (fc: Firecrawl, url: string) => Promise<string[]>;
  extractionHint?: string;
};

const classicDriverAdapter: SiteAdapter = {
  id: "classicdriver",
  hostMatch: ["classicdriver.com"],
  isDetailUrl(u) {
    try {
      const url = new URL(u);
      if (!url.hostname.includes("classicdriver.com")) return false;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length < 6) return false;
      const segment = parts[1]?.toLowerCase();
      if (!["car", "auto", "voiture", "automobile"].includes(segment)) return false;
      const last = parts[parts.length - 1];
      return /^\d{3,}$/.test(last);
    } catch {
      return false;
    }
  },
  async discover(fc, url) {
    const result = await fc.scrape(url, {
      formats: ["links"],
      onlyMainContent: false,
      waitFor: 5000,
    });
    return extractLinks(result);
  },
  extractionHint:
    "This is a single dealer listing for a specific car. Use the listed asking price (convert to USD if needed). Use the model year of THIS car.",
};

const wikipediaAdapter: SiteAdapter = {
  id: "wikipedia",
  hostMatch: ["wikipedia.org"],
  isDetailUrl(u) {
    try {
      const url = new URL(u);
      if (!url.hostname.endsWith("wikipedia.org")) return false;
      if (!url.pathname.startsWith("/wiki/")) return false;
      const slug = decodeURIComponent(url.pathname.slice("/wiki/".length));
      // Exclude meta / namespace pages
      if (slug.includes(":")) return false;
      if (slug.includes("#")) return false;
      // Exclude obvious non-model pages by slug heuristics
      const lower = slug.toLowerCase();
      const blocklist = [
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
        "_concept",
        "_factory",
        "_museum",
        "_logo",
        "_family",
      ];
      if (blocklist.some((b) => lower.endsWith(b) || lower.includes(b))) return false;
      return true;
    } catch {
      return false;
    }
  },
  async discover(fc, url) {
    // Wikipedia is server-rendered; no waitFor needed. Pull links + markdown so
    // we can scope discovery to the manufacturer's model navbox/sections.
    const result = await fc.scrape(url, {
      formats: ["links", "markdown"],
      onlyMainContent: true,
    });

    const allLinks = extractLinks(result);
    const markdown =
      (result as { markdown?: string }).markdown ??
      (result as { data?: { markdown?: string } }).data?.markdown ??
      "";

    // Derive the make from the page URL: /wiki/Porsche -> "porsche"
    const makeSlug = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "")
      .toLowerCase()
      .split("_")[0];

    // Keep only links to /wiki/<Make>_<something>, which is the standard
    // Wikipedia naming convention for a manufacturer's models.
    const candidates = allLinks
      .map((l) => {
        try {
          const u = new URL(l);
          if (!u.hostname.endsWith("wikipedia.org")) return null;
          if (!u.pathname.startsWith("/wiki/")) return null;
          const slug = decodeURIComponent(u.pathname.slice("/wiki/".length));
          return { full: `${u.origin}${u.pathname}`, slug };
        } catch {
          return null;
        }
      })
      .filter((x): x is { full: string; slug: string } => x !== null)
      .filter(({ slug }) => {
        const lower = slug.toLowerCase();
        // Must mention the make in the slug
        if (makeSlug && !lower.startsWith(makeSlug)) return false;
        // Must look like Make_<Model>
        if (!slug.includes("_")) return false;
        return true;
      });

    // Boost links that appear in the markdown body (the navbox/lists are
    // rendered as markdown links by Firecrawl) — this naturally restricts to
    // the consumer-models section rather than every link on the page.
    const inBody = new Set<string>();
    for (const m of markdown.matchAll(/\]\((\/wiki\/[^)\s]+)\)/g)) {
      inBody.add(m[1]);
    }

    const scored = candidates.map((c) => {
      const path = new URL(c.full).pathname;
      return { ...c, score: inBody.has(path) ? 2 : 1 };
    });

    // Dedupe + apply isDetailUrl filter for safety
    const seen = new Set<string>();
    const finalUrls: string[] = [];
    for (const c of scored.sort((a, b) => b.score - a.score)) {
      if (seen.has(c.full)) continue;
      seen.add(c.full);
      if (wikipediaAdapter.isDetailUrl(c.full)) finalUrls.push(c.full);
    }
    return finalUrls;
  },
  extractionHint:
    "This is a Wikipedia article about a car MODEL (not a single car for sale). " +
    "Set price to 0 (Wikipedia pages don't list prices). " +
    "For 'year', use the year of the MOST ICONIC generation/variant of this model " +
    "(the era enthusiasts most associate with it), not necessarily the original launch year. " +
    "The 'history' field should summarize the model's history and significance. " +
    "Pick 'type' based on the most iconic body style.",
};

const ADAPTERS: SiteAdapter[] = [classicDriverAdapter, wikipediaAdapter];

function findAdapter(url: string): SiteAdapter | null {
  return ADAPTERS.find((a) => a.hostMatch.some((h) => url.includes(h))) ?? null;
}

const SUPPORTED_HOSTS = ADAPTERS.flatMap((a) => a.hostMatch).join(", ");

function extractLinks(result: unknown): string[] {
  const r = result as { links?: unknown; data?: { links?: unknown } };
  const raw = r.links ?? r.data?.links ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => (typeof l === "string" ? l : (l as { url?: string })?.url))
    .filter((u): u is string => typeof u === "string");
}

// =============================================================================
// Schemas
// =============================================================================

const SUPPORTED_URL = z
  .string()
  .url()
  .refine((u) => findAdapter(u) !== null, {
    message: `URL must be from a supported site (${SUPPORTED_HOSTS})`,
  });

const InputSchema = z.object({ url: SUPPORTED_URL });

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

// =============================================================================
// Helpers
// =============================================================================

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
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
        Referer: "https://www.google.com/",
      },
    });
    if (!res.ok) {
      console.error(`[uploadImage] fetch failed ${res.status} for ${imageUrl}`);
      return imageUrl;
    }
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : ct.includes("svg") ? "svg" : "jpg";
    const buf = new Uint8Array(await res.arrayBuffer());
    const path = `${slug}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("car-images")
      .upload(path, buf, { contentType: ct, upsert: false });
    if (error) {
      console.error("[uploadImage] storage upload failed:", error.message);
      return imageUrl;
    }
    const { data } = supabaseAdmin.storage.from("car-images").getPublicUrl(path);
    console.log("[uploadImage] uploaded:", data.publicUrl);
    return data.publicUrl;
  } catch (e) {
    console.error("[uploadImage] exception:", e);
    return imageUrl;
  }
}

async function aiExtract(markdown: string, sourceUrl: string, hint?: string) {
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
          price: { type: "integer", description: "Price in USD; if EUR/GBP convert roughly; 0 if unknown or N/A" },
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

  const systemBase =
    "You are a classic-car expert. Extract a car entry from scraped content. " +
    "Use your knowledge of the model to fill the rank fields and known defects accurately. " +
    "Be concise and factual. Always call the save_car tool.";
  const system = hint ? `${systemBase}\n\nSource-specific guidance:\n${hint}` : systemBase;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
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

// =============================================================================
// Discovery
// =============================================================================

const MAX_DISCOVERY = 50;

const DiscoverInputSchema = z.object({
  url: SUPPORTED_URL,
  limit: z.number().int().min(1).max(MAX_DISCOVERY).optional().default(20),
});

export const discoverCarUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DiscoverInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");

    const adapter = findAdapter(data.url);
    if (!adapter) throw new Error("Unsupported source URL");

    const fc = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });

    let candidateUrls: string[] = [];
    if (adapter.discover) {
      candidateUrls = await adapter.discover(fc, data.url);
    } else {
      const result = await fc.scrape(data.url, {
        formats: ["links"],
        onlyMainContent: false,
      });
      candidateUrls = extractLinks(result).filter(adapter.isDetailUrl);
    }

    const carUrls = Array.from(new Set(candidateUrls));

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
      source: adapter.id,
    };
  });

// =============================================================================
// Single-page scrape
// =============================================================================

async function scrapeOne(url: string) {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");

  const adapter = findAdapter(url);
  if (!adapter) throw new Error("Unsupported source URL");

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

  const extracted = await aiExtract(markdown, url, adapter.extractionHint);

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
      make: extracted.name.split(" ")[0],
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

// =============================================================================
// Bulk + single server functions
// =============================================================================

const ScrapeManyInputSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(MAX_DISCOVERY),
});

export const scrapeManyCars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScrapeManyInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const results: Array<{ url: string; ok: boolean; name?: string; slug?: string; error?: string }> = [];
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
