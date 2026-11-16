import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Trash2, Bell } from "lucide-react";
import { listCars } from "@/lib/cars-public.functions";
import type { Car } from "@/data/cars";
import { projectsStore, useProjects } from "@/lib/projects-store";
import { toast } from "sonner";

export const Route = createFileRoute("/my-projects/")({
  head: () => ({
    meta: [
      { title: "My Car Projects — Garage Log" },
      { name: "description", content: "Your saved car restoration projects." },
    ],
  }),
  loader: () => listCars(),
  component: MyProjects,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl mb-3">Couldn't load your projects</h1>
        <p className="text-muted-foreground mb-6">{error instanceof Error ? error.message : String(error)}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Try again
        </button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-12 text-center">Not found</div>,
});

const fmt = (n: number) => `$${n.toLocaleString()}`;

function MyProjects() {
  const cars = Route.useLoaderData() as Car[];
  useProjects();
  const state = projectsStore.getAll();
  const list = cars.filter((c) => c.id in state.projects);

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
          <p className="font-display text-3xl mb-3">Nothing here</p>
          <p className="text-muted-foreground mb-6">
            Browse the library and add cars you'd like to restore — or set an alert to start hunting.
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-5 py-3 bg-primary text-primary-foreground rounded-md font-display text-lg tracking-wide shadow-[var(--shadow-stamp)] hover:bg-primary/90 transition-colors"
          >
            Browse the library
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((c) => {
            const alert = state.projects[c.id];
            return (
              <div
                key={c.id}
                className="bg-card border-2 border-foreground/15 rounded-lg overflow-hidden shadow-[var(--shadow-card)] flex flex-col"
              >
                <Link to="/my-projects/$carId" params={{ carId: c.id }} className="block aspect-[3/2] overflow-hidden">
                  <img
                    src={c.image}
                    alt={c.name}
                    loading="lazy"
                    width={1024}
                    height={768}
                    className="h-full w-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                </Link>
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <p className="font-stencil text-xs uppercase text-muted-foreground">
                      {c.type} · {c.year}
                    </p>
                    {alert ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent text-accent-foreground font-stencil text-[10px] uppercase tracking-wider">
                        <Bell className="h-3 w-3" />
                        Seeking
                      </span>
                    ) : null}
                  </div>
                  <Link
                    to="/my-projects/$carId"
                    params={{ carId: c.id }}
                    className="font-display text-2xl hover:text-primary leading-tight"
                  >
                    {c.name}
                  </Link>
                  <p className="font-display text-2xl text-primary">{fmt(c.price)}</p>
                  {alert ? (
                    <p className="text-xs text-muted-foreground">
                      {alert.sources.length > 0
                        ? `Watching ${alert.sources.length} source${alert.sources.length > 1 ? "s" : ""}`
                        : "No sources selected"}
                      {alert.year ? ` · year ${alert.year}` : ""}
                      {alert.notify !== "none" ? ` · ${alert.notify} notifs` : ""}
                    </p>
                  ) : null}
                  <button
                    onClick={() => {
                      projectsStore.remove(c.id);
                      toast.success(`Removed ${c.name} from projects`);
                    }}
                    className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-2 border-2 border-foreground/15 rounded-md text-sm font-medium hover:border-destructive hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
