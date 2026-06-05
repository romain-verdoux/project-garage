import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-only imports happen inside .handler() via dynamic import to keep the
// client bundle free of service-role keys (this file is reachable from routes).

const UA = "ProjectGarage/1.0 (https://project-garage.lovable.app)";

// -----------------------------------------------------------------------------
// Wikipedia summary lookup → returns originalimage/thumbnail URL when found.
// -----------------------------------------------------------------------------
async function tryWikipedia(make: string, name: string): Promise<string | null> {
  // Build a few candidate titles, query MediaWiki search API first for accuracy
  const query = `${make} ${name}`.replace(/\s+/g, " ").trim();
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query + " car",
    )}&format=json&srlimit=1&origin=*`;
    const sres = await fetch(searchUrl, { headers: { "User-Agent": UA } });
    if (!sres.ok) return null;
    const sjson = (await sres.json()) as { query?: { search?: { title: string }[] } };
    const title = sjson.query?.search?.[0]?.title;
    if (!title) return null;
    const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title.replace(/ /g, "_"),
    )}`;
    const r = await fetch(sumUrl, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      originalimage?: { source?: string };
      thumbnail?: { source?: string };
      type?: string;
    };
    if (j.type === "disambiguation") return null;
    return j.originalimage?.source ?? j.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Google Images fallback via Firecrawl search (sources: images).
// -----------------------------------------------------------------------------
async function tryGoogleImages(make: string, name: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  const query = `${make} ${name} car`;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        sources: ["images"],
        limit: 3,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { images?: { url?: string; imageUrl?: string; src?: string }[] };
    };
    const imgs = json.data?.images ?? [];
    for (const im of imgs) {
      const url = im.imageUrl || im.url || im.src;
      if (url && /^https?:\/\//.test(url)) return url;
    }
    return null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Public server functions
// -----------------------------------------------------------------------------

export const countMissingImages = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("cars")
    .select("id", { count: "exact", head: true })
    .is("image_url", null);
  if (error) throw new Error(error.message);
  return { remaining: count ?? 0 };
});

export const backfillCarImages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ batchSize: z.number().int().min(1).max(25).default(10) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("cars")
      .select("id, name, make")
      .is("image_url", null)
      .limit(data.batchSize);
    if (error) throw new Error(error.message);

    const results: { id: string; name: string; ok: boolean; source?: string; error?: string }[] = [];

    for (const row of rows ?? []) {
      const make = (row.make || "").trim();
      // Strip leading make from name if duplicated
      const nameOnly = row.name.replace(new RegExp(`^${make}\\s+`, "i"), "").trim() || row.name;
      let url = await tryWikipedia(make, nameOnly);
      let source: string | undefined = url ? "wikipedia" : undefined;
      if (!url) {
        url = await tryGoogleImages(make, nameOnly);
        if (url) source = "google";
      }
      if (url) {
        const { error: upErr } = await supabaseAdmin
          .from("cars")
          .update({ image_url: url })
          .eq("id", row.id);
        if (upErr) {
          results.push({ id: row.id, name: row.name, ok: false, error: upErr.message });
        } else {
          results.push({ id: row.id, name: row.name, ok: true, source });
        }
      } else {
        results.push({ id: row.id, name: row.name, ok: false, error: "no image found" });
      }
    }

    const { count } = await supabaseAdmin
      .from("cars")
      .select("id", { count: "exact", head: true })
      .is("image_url", null);

    return {
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      remaining: count ?? 0,
      results,
    };
  });
