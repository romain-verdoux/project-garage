import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, Bell } from "lucide-react";
import { cars } from "@/data/cars";
import { projectsStore, useProjects } from "@/lib/projects-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const state = projectsStore.getAll();
  const projectList = cars.filter((c) => state.project.includes(c.id));
  const seekingIds = Object.keys(state.seeking);
  const seekingList = cars.filter((c) => seekingIds.includes(c.id));

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-10 border-b-2 border-foreground/15 pb-6">
        <p className="font-stencil text-xs uppercase tracking-[0.3em] text-primary mb-2">// the wishlist</p>
        <h1 className="font-display text-5xl md:text-6xl">My Car Projects</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          The cars you've earmarked for the garage. Saved locally on this device.
        </p>
      </header>

      <Tabs defaultValue="project">
        <TabsList className="mb-6">
          <TabsTrigger value="project" className="font-stencil uppercase tracking-wider">
            Project ({projectList.length})
          </TabsTrigger>
          <TabsTrigger value="seeking" className="font-stencil uppercase tracking-wider">
            Seeking ({seekingList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="project">
          {projectList.length === 0 ? (
            <EmptyState message="No projects yet. Browse the library and add cars you'd like to restore." />
          ) : (
            <div className="space-y-4">
              {projectList.map((c) => (
                <CarRow
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  type={c.type}
                  year={c.year}
                  price={c.price}
                  image={c.image}
                  onRemove={() => {
                    projectsStore.remove(c.id);
                    toast.success(`Removed ${c.name} from projects`);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="seeking">
          {seekingList.length === 0 ? (
            <EmptyState message="No active alerts. Open a car and click ‘Find my …’ to start gathering ads." />
          ) : (
            <div className="space-y-4">
              {seekingList.map((c) => {
                const alert = state.seeking[c.id];
                return (
                  <CarRow
                    key={c.id}
                    id={c.id}
                    name={c.name}
                    type={c.type}
                    year={c.year}
                    price={c.price}
                    image={c.image}
                    badge={
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-accent text-accent-foreground font-stencil text-xs uppercase tracking-wider">
                        <Bell className="h-3 w-3" />
                        {alert?.notify === "none" ? "No notifs" : alert?.notify}
                      </span>
                    }
                    extra={
                      alert ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.sources.length > 0
                            ? `Watching ${alert.sources.length} source${alert.sources.length > 1 ? "s" : ""}`
                            : "No sources selected"}
                          {alert.year ? ` · year ${alert.year}` : ""}
                        </p>
                      ) : null
                    }
                    onRemove={() => {
                      projectsStore.removeSeeking(c.id);
                      toast.success(`Alert removed for ${c.name}`);
                    }}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border-2 border-dashed border-foreground/20 rounded-xl p-16 text-center">
      <p className="font-display text-3xl mb-3">Nothing here</p>
      <p className="text-muted-foreground mb-6">{message}</p>
      <Link
        to="/"
        className="inline-flex items-center px-5 py-3 bg-primary text-primary-foreground rounded-md font-display text-lg tracking-wide shadow-[var(--shadow-stamp)] hover:bg-primary/90 transition-colors"
      >
        Browse the library
      </Link>
    </div>
  );
}

function CarRow({
  id,
  name,
  type,
  year,
  price,
  image,
  badge,
  extra,
  onRemove,
}: {
  id: string;
  name: string;
  type: string;
  year: number;
  price: number;
  image: string;
  badge?: React.ReactNode;
  extra?: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <div className="bg-card border-2 border-foreground/15 rounded-lg overflow-hidden flex flex-col sm:flex-row shadow-[var(--shadow-card)]">
      <Link
        to="/cars/$carId"
        params={{ carId: id }}
        className="sm:w-64 aspect-[3/2] sm:aspect-auto shrink-0 overflow-hidden"
      >
        <img
          src={image}
          alt={name}
          loading="lazy"
          width={1024}
          height={768}
          className="h-full w-full object-cover hover:scale-105 transition-transform duration-500"
        />
      </Link>
      <div className="flex-1 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-stencil text-xs uppercase text-muted-foreground">
              {type} · {year}
            </p>
            {badge}
          </div>
          <Link to="/cars/$carId" params={{ carId: id }} className="font-display text-2xl hover:text-primary">
            {name}
          </Link>
          <p className="font-display text-2xl text-primary mt-1">{fmt(price)}</p>
          {extra}
        </div>
        <button
          onClick={onRemove}
          className="inline-flex items-center gap-2 px-4 py-2 border-2 border-foreground/15 rounded-md text-sm font-medium hover:border-destructive hover:text-destructive transition-colors"
        >
          <Trash2 className="h-4 w-4" /> Remove
        </button>
      </div>
    </div>
  );
}
