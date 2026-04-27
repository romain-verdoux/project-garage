import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { cars } from "@/data/cars";
import { projectsStore, useProjects } from "@/lib/projects-store";
import { toast } from "sonner";

export const Route = createFileRoute("/my-projects")({
  head: () => ({
    meta: [
      { title: "My Car Projects — Garage Log" },
      { name: "description", content: "Your saved car restoration projects." },
    ],
  }),
  component: MyProjects,
});

const fmt = (n: number) => `$${n.toLocaleString()}`;

function MyProjects() {
  useProjects();
  const ids = projectsStore.getAll();
  const list = cars.filter((c) => ids.includes(c.id));

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-10 border-b-2 border-foreground/15 pb-6">
        <p className="font-stencil text-xs uppercase tracking-[0.3em] text-primary mb-2">// the wishlist</p>
        <h1 className="font-display text-5xl md:text-6xl">My Car Projects</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          The cars you've earmarked for the garage. Saved locally on this device.
        </p>
      </header>

      {list.length === 0 ? (
        <div className="border-2 border-dashed border-foreground/20 rounded-xl p-16 text-center">
          <p className="font-display text-3xl mb-3">No projects yet</p>
          <p className="text-muted-foreground mb-6">
            Browse the library and add cars you'd like to restore.
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-5 py-3 bg-primary text-primary-foreground rounded-md font-display text-lg tracking-wide shadow-[var(--shadow-stamp)] hover:bg-primary/90 transition-colors"
          >
            Browse the library
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((c) => (
            <div
              key={c.id}
              className="bg-card border-2 border-foreground/15 rounded-lg overflow-hidden flex flex-col sm:flex-row shadow-[var(--shadow-card)]"
            >
              <Link
                to="/cars/$carId"
                params={{ carId: c.id }}
                className="sm:w-64 aspect-[3/2] sm:aspect-auto shrink-0 overflow-hidden"
              >
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  width={1024}
                  height={768}
                  className="h-full w-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </Link>
              <div className="flex-1 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-stencil text-xs uppercase text-muted-foreground">{c.type} · {c.year}</p>
                  <Link to="/cars/$carId" params={{ carId: c.id }} className="font-display text-2xl hover:text-primary">
                    {c.name}
                  </Link>
                  <p className="font-display text-2xl text-primary mt-1">{fmt(c.price)}</p>
                </div>
                <button
                  onClick={() => {
                    projectsStore.remove(c.id);
                    toast.success(`Removed ${c.name}`);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 border-2 border-foreground/15 rounded-md text-sm font-medium hover:border-destructive hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
