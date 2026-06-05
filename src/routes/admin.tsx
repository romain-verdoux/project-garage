import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { scrapeCarFromUrl, discoverCarUrls, scrapeManyCars } from "@/server/cars.functions";
import { importAllFromWikipedia } from "@/server/wikipedia-bulk.functions";
import { listCarsAdmin, deleteCarById, updateCarField, type AdminCar } from "@/lib/cars-public.functions";
import { CAR_TYPES, DECADES } from "@/data/cars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
function EditableCell({
  value,
  onSave,
  type = "text",
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  type?: "text" | "number";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      toast.success("Saved");
    } catch {
      toast.error("Save failed");
      setDraft(value);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <TableCell>
        <Input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          disabled={saving}
          className="h-7 text-xs"
        />
      </TableCell>
    );
  }

  return (
    <TableCell
      className="cursor-pointer hover:bg-muted/50 font-medium"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value || <span className="text-muted-foreground italic">—</span>}
    </TableCell>
  );
}

function EditableSelect({
  value,
  options,
  onSave,
}: {
  value: string;
  options: readonly string[];
  onSave: (v: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <TableCell>
      <select
        value={value}
        disabled={saving}
        className="bg-transparent text-sm cursor-pointer border-none outline-none"
        onChange={async (e) => {
          const v = e.target.value;
          setSaving(true);
          try {
            await onSave(v);
            toast.success("Saved");
          } catch {
            toast.error("Save failed");
          } finally {
            setSaving(false);
          }
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </TableCell>
  );
}
function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const scrape = useServerFn(scrapeCarFromUrl);
  const discover = useServerFn(discoverCarUrls);
  const scrapeMany = useServerFn(scrapeManyCars);
  const importAll = useServerFn(importAllFromWikipedia);
  const deleteCar = useServerFn(deleteCarById);
  const updateField = useServerFn(updateCarField);

  // Car list
  const [cars, setCars] = useState<AdminCar[]>([]);
  const [carsLoading, setCarsLoading] = useState(false);
  const loadCars = useCallback(async () => {
    setCarsLoading(true);
    try {
      const list = await listCarsAdmin();
      setCars(list);
    } catch {
      toast.error("Failed to load car list");
    } finally {
      setCarsLoading(false);
    }
  }, []);

  // Wiki one-shot mode
  const [wikiUrl, setWikiUrl] = useState("");
  const [wikiBusy, setWikiBusy] = useState(false);
  const [wikiStatus, setWikiStatus] = useState("");
  const [wikiResults, setWikiResults] = useState<BulkResult[]>([]);

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
      loadCars();
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
      if (ok > 0) { toast.success(`Imported ${ok} cars`); loadCars(); }
      if (failed > 0) toast.error(`${failed} failed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk scrape failed");
      setBulkStatus("Failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function onSubmitWiki(e: React.FormEvent) {
    e.preventDefault();
    setWikiBusy(true);
    setWikiResults([]);
    setWikiStatus("Fetching manufacturer page from Wikipedia API…");
    try {
      const res = await importAll({ data: { manufacturerUrl: wikiUrl } });
      setWikiResults(res.results);
      setWikiStatus(
        `${res.makeName}: discovered ${res.discovered} models · skipped ${res.skipped} (already imported) · imported ${res.imported} · failed ${res.failed}.`,
      );
      if (res.imported > 0) { toast.success(`Imported ${res.imported} cars`); loadCars(); }
      if (res.imported === 0 && res.failed === 0 && res.discovered === res.skipped) {
        toast.info("Nothing new to import");
      }
      if (res.failed > 0) toast.error(`${res.failed} failed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wiki import failed");
      setWikiStatus("Failed.");
    } finally {
      setWikiBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl mb-2">Import cars</h1>
      <p className="text-muted-foreground mb-8">
        Add cars to the library from a supported source. Single URL imports one car/model;
        parent URL auto-imports every car/model linked from it.
        <br />
        <span className="text-xs">
          Supported: <code>classicdriver.com</code> (dealer listings) ·{" "}
          <code>wikipedia.org</code> (manufacturer page → all consumer models)
        </span>
      </p>

      <Tabs defaultValue="wiki">
        <TabsList className="mb-4">
          <TabsTrigger value="wiki">Wikipedia (one-click, all models)</TabsTrigger>
          <TabsTrigger value="single">Single URL</TabsTrigger>
          <TabsTrigger value="bulk">Parent URL (Firecrawl)</TabsTrigger>
        </TabsList>

        <TabsContent value="wiki">
          <form onSubmit={onSubmitWiki} className="space-y-4 rounded-lg border bg-card p-6">
            <div>
              <Label htmlFor="wikiUrl">Wikipedia manufacturer URL</Label>
              <Input
                id="wikiUrl"
                type="url"
                required
                placeholder="https://en.wikipedia.org/wiki/Porsche"
                value={wikiUrl}
                onChange={(e) => setWikiUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Uses the MediaWiki API directly — no scraping. Discovers every consumer model
                linked from the page (navboxes + Models/Production sections), fetches each summary
                in parallel, and lets the AI fill restoration ratings. Up to 150 models per call.
              </p>
            </div>
            <Button type="submit" disabled={wikiBusy} className="w-full">
              {wikiBusy ? "Importing… (1–3 min for a full manufacturer)" : "Import all models"}
            </Button>
            {wikiStatus && <p className="text-sm text-muted-foreground">{wikiStatus}</p>}
          </form>

          {wikiResults.length > 0 && (
            <div className="mt-6 rounded-lg border bg-card divide-y max-h-[500px] overflow-auto">
              {wikiResults.map((r) => (
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

        <TabsContent value="single">
          <form onSubmit={onSubmitSingle} className="space-y-4 rounded-lg border bg-card p-6">
            <div>
              <Label htmlFor="url">Listing or model URL</Label>
              <Input
                id="url"
                type="url"
                required
                placeholder="https://en.wikipedia.org/wiki/Porsche_911 or https://www.classicdriver.com/en/car/..."
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
              <Label htmlFor="parentUrl">Parent URL (manufacturer page, search results…)</Label>
              <Input
                id="parentUrl"
                type="url"
                required
                placeholder="https://en.wikipedia.org/wiki/Porsche"
                value={parentUrl}
                onChange={(e) => setParentUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wikipedia: paste a manufacturer page (e.g. <code>/wiki/Porsche</code>) to import every linked model.
                Classic Driver: paste a search/listing URL.
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

      {/* ── Car library management ── */}
      <section className="mt-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">Library ({cars.length} cars)</h2>
          <Button variant="outline" size="sm" onClick={loadCars} disabled={carsLoading}>
            {carsLoading ? "Loading…" : cars.length ? "Refresh" : "Load list"}
          </Button>
        </div>

        {cars.length > 0 && (
          <div className="rounded-lg border bg-card max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Name</TableHead>
                  <TableHead className="min-w-[100px]">Make</TableHead>
                  <TableHead className="min-w-[100px]">Type</TableHead>
                  <TableHead className="min-w-[90px]">Price ($)</TableHead>
                  <TableHead className="min-w-[70px]">Year</TableHead>
                  <TableHead className="min-w-[70px]">Decade</TableHead>
                  <TableHead className="w-24 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cars.map((car) => (
                  <TableRow key={car.id}>
                    <EditableCell
                      value={car.name}
                      onSave={async (v) => {
                        await updateField({ data: { id: car.id, field: "name", value: v } });
                        setCars((p) => p.map((c) => (c.id === car.id ? { ...c, name: v } : c)));
                      }}
                    />
                    <EditableCell
                      value={car.make}
                      onSave={async (v) => {
                        await updateField({ data: { id: car.id, field: "make", value: v } });
                        setCars((p) => p.map((c) => (c.id === car.id ? { ...c, make: v } : c)));
                      }}
                    />
                    <EditableSelect
                      value={car.type}
                      options={CAR_TYPES}
                      onSave={async (v) => {
                        await updateField({ data: { id: car.id, field: "type", value: v } });
                        setCars((p) => p.map((c) => (c.id === car.id ? { ...c, type: v } : c)));
                      }}
                    />
                    <EditableCell
                      value={String(car.price)}
                      type="number"
                      onSave={async (v) => {
                        const num = Number(v);
                        await updateField({ data: { id: car.id, field: "price", value: num } });
                        setCars((p) => p.map((c) => (c.id === car.id ? { ...c, price: num } : c)));
                      }}
                    />
                    <EditableCell
                      value={String(car.year)}
                      type="number"
                      onSave={async (v) => {
                        const num = Number(v);
                        await updateField({ data: { id: car.id, field: "year", value: num } });
                        setCars((p) => p.map((c) => (c.id === car.id ? { ...c, year: num } : c)));
                      }}
                    />
                    <EditableSelect
                      value={car.decade}
                      options={DECADES}
                      onSave={async (v) => {
                        await updateField({ data: { id: car.id, field: "decade", value: v } });
                        setCars((p) => p.map((c) => (c.id === car.id ? { ...c, decade: v } : c)));
                      }}
                    />
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          if (!confirm(`Delete "${car.name}"?`)) return;
                          try {
                            await deleteCar({ data: { id: car.id } });
                            setCars((prev) => prev.filter((c) => c.id !== car.id));
                            router.invalidate();
                            toast.success(`Deleted "${car.name}"`);
                          } catch {
                            toast.error("Failed to delete car");
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
