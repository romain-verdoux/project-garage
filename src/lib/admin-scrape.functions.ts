import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const UrlInputSchema = z.object({ url: z.string().url() });

const DiscoverInputSchema = z.object({
  url: z.string().url(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

const ScrapeManyInputSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50),
});

const WikipediaImportInputSchema = z.object({
  manufacturerUrl: z.string().url(),
  maxCars: z.number().int().min(1).max(200).optional().default(150),
});

export const scrapeCarFromUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => UrlInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { scrapeCarFromUrl: scrape } = await import("@/server/cars.functions");
    return scrape({ data });
  });

export const discoverCarUrls = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => DiscoverInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { discoverCarUrls: discover } = await import("@/server/cars.functions");
    return discover({ data });
  });

export const scrapeManyCars = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ScrapeManyInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { scrapeManyCars: scrapeMany } = await import("@/server/cars.functions");
    return scrapeMany({ data });
  });

export const importAllFromWikipedia = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => WikipediaImportInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { importAllFromWikipedia: importAll } = await import("@/server/wikipedia-bulk.functions");
    return importAll({ data });
  });