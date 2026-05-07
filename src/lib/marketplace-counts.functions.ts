import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Scrape marketplace URLs to extract the number of ads shown.
 * Uses Firecrawl JSON extraction with a prompt.
 */
export const fetchMarketplaceCounts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        urls: z.array(
          z.object({ id: z.string(), url: z.string().url() }),
        ).min(1).max(10),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<Record<string, number | null>> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.error("FIRECRAWL_API_KEY not set – skipping marketplace counts");
      return Object.fromEntries(data.urls.map((u) => [u.id, null]));
    }

    const results: Record<string, number | null> = {};

    // Scrape in parallel (with a small concurrency to be polite)
    await Promise.all(
      data.urls.map(async ({ id, url }) => {
        try {
          const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              url,
              formats: ["json"],
              jsonOptions: {
                prompt:
                  "Extract the total number of car ads / listings / results shown on this page. Return only the integer count. If you cannot determine the count, return 0.",
                schema: {
                  type: "object",
                  properties: {
                    count: {
                      type: "integer",
                      description:
                        "Total number of car ads / listings / results found on the page",
                    },
                  },
                  required: ["count"],
                },
              },
              waitFor: 3000,
            }),
          });

          if (!res.ok) {
            console.error(`Firecrawl error for ${id}: ${res.status} ${res.statusText}`);
            results[id] = null;
            return;
          }

          const body = await res.json();
          const count =
            body?.data?.json?.count ??
            body?.json?.count ??
            body?.data?.count ??
            null;

          results[id] = typeof count === "number" ? count : null;
        } catch (err) {
          console.error(`Firecrawl fetch failed for ${id}:`, err);
          results[id] = null;
        }
      }),
    );

    return results;
  });
