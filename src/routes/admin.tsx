import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { scrapeCarFromUrl } from "@/server/cars.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Scrape a car" },
      { name: "description", content: "Admin tools to import cars from Classic Driver." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const scrape = useServerFn(scrapeCarFromUrl);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSlug, setLastSlug] = useState<string | null>(null);

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

  async function onSubmit(e: React.FormEvent) {
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-4xl mb-2">Import a car</h1>
      <p className="text-muted-foreground mb-8">
        Paste a Classic Driver listing URL. We'll scrape it, extract details with AI, and add it to the library.
      </p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6">
        <div>
          <Label htmlFor="url">Classic Driver URL</Label>
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
    </main>
  );
}
