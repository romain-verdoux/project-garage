import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { scrapeCarFromUrl, discoverCarUrls, scrapeManyCars } from "@/server/cars.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Scrape cars" },
      { name: "description", content: "Admin tools to import cars from Classic Driver." },
    ],
  }),
  component: AdminPage,
});

type BulkResult = { url: string; ok: boolean; name?: string; slug?: string; error?: string };

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const scrape = useServerFn(scrapeCarFromUrl);
  const discover = useServerFn(discoverCarUrls);
  const scrapeMany = useServerFn(scrapeManyCars);

  // Single mode
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSlug, setLastSlug] = useState<string | null>(null);

  // Bulk mode
  const [parentUrl, setParentUrl] = useState("");
  const [limit, setLimit] = useState(20);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);

  if (loading) {
    return <main className="mx-auto max-w-2xl px-6 py-16">Loading…</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display text-4xl mb-4">Admin</h1>
        <p className="text-muted-foreground mb-6">You need to be signed in to access admin tools.</p>
        <Button onClick={() => navigate({ to: "/auth" })}>Sign in</Button>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display text-4xl mb-4">Admin only</h1>
        <p className="text-muted-foreground">
          Your account ({user.email}) doesn't have admin access. Ask an existing admin to grant you the role.
        </p>
        <p className="text-xs text-muted-foreground mt-4 break-all">User ID: {user.id}</p>
      </main>
    );
  }

  async function onSubmitSingle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLastSlug(null);
    try {
      const result = await scrape({ data: { url } });
      toast.success(`Imported "${result.car.name}"`);
      setLastSlug(result.car.slug);
      setUrl("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitBulk(e: React.FormEvent) {
    e.preventDefault();
    setBulkBusy(true);
    setBulkResults([]);
    setBulkStatus("Discovering car listings…");
    try {
      const { urls, total, alreadyImported } = await discover({
        data: { url: parentUrl, limit },
      });
      if (urls.length === 0) {
        setBulkStatus(
          total === 0
            ? "No car detail pages found under that URL."
            : `All ${total} discovered cars are already imported.`,
        );
        toast.info("Nothing new to import");
        return;
      }
      setBulkStatus(
        `Found ${total} cars (${alreadyImported} already imported). Importing ${urls.length} new… this can take a while.`,
      );
      const { results } = await scrapeMany({ data: { urls } });
      setBulkResults(results);
      const ok = results.filter((r) => r.ok).length;
      const failed = results.length - ok;
      setBulkStatus(`Done. Imported ${ok}, failed ${failed}.`);
      if (ok > 0) toast.success(`Imported ${ok} cars`);
      if (failed > 0) toast.error(`${failed} failed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk scrape failed");
      setBulkStatus("Failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl mb-2">Import cars</h1>
      <p className="text-muted-foreground mb-8">
        Scrape Classic Driver to add cars to the library. Pick a single listing or a parent page (search results, make/model index) to auto-import every car under it.
      </p>

      <Tabs defaultValue="single">
        <TabsList className="mb-4">
          <TabsTrigger value="single">Single URL</TabsTrigger>
          <TabsTrigger value="bulk">Parent URL (auto-import all)</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <form onSubmit={onSubmitSingle} className="space-y-4 rounded-lg border bg-card p-6">
            <div>
              <Label htmlFor="url">Classic Driver listing URL</Label>
              <Input
                id="url"
                type="url"
                required
                placeholder="https://www.classicdriver.com/en/car/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Scraping & extracting (this can take 30s)…" : "Scrape & import"}
            </Button>
          </form>

          {lastSlug && (
            <div className="mt-6 rounded-lg border bg-card p-4 flex items-center justify-between">
              <span className="text-sm">Imported successfully.</span>
              <Link to="/library/$carId" params={{ carId: lastSlug }} className="text-primary underline text-sm">
                View car →
              </Link>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bulk">
          <form onSubmit={onSubmitBulk} className="space-y-4 rounded-lg border bg-card p-6">
            <div>
              <Label htmlFor="parentUrl">Parent URL (search results, make page, etc.)</Label>
              <Input
                id="parentUrl"
                type="url"
                required
                placeholder="https://www.classicdriver.com/en/cars/search?..."
                value={parentUrl}
                onChange={(e) => setParentUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                We'll discover every car detail page under this URL and import each one.
              </p>
            </div>
            <div>
              <Label htmlFor="limit">Max cars to import (1–50)</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                max={50}
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              />
            </div>
            <Button type="submit" disabled={bulkBusy} className="w-full">
              {bulkBusy ? "Working… (this can take several minutes)" : "Discover & import all"}
            </Button>
            {bulkStatus && <p className="text-sm text-muted-foreground">{bulkStatus}</p>}
          </form>

          {bulkResults.length > 0 && (
            <div className="mt-6 rounded-lg border bg-card divide-y">
              {bulkResults.map((r) => (
                <div key={r.url} className="p-3 text-sm flex items-start gap-3">
                  <span className={r.ok ? "text-green-600" : "text-destructive"}>
                    {r.ok ? "✓" : "✗"}
                  </span>
                  <div className="flex-1 min-w-0">
                    {r.ok ? (
                      <Link
                        to="/library/$carId"
                        params={{ carId: r.slug! }}
                        className="text-primary underline"
                      >
                        {r.name}
                      </Link>
                    ) : (
                      <span className="text-destructive">{r.error}</span>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{r.url}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
