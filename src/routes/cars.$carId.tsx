import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { getCar } from "@/data/cars";
import { Stars, DifficultyBadge, CostBadge, SpecRow } from "@/components/SpecRow";
import { projectsStore, useProjects } from "@/lib/projects-store";
import { toast } from "sonner";

export const Route = createFileRoute("/cars/$carId")({
  loader: ({ params }) => {
    const car = getCar(params.carId);
    if (!car) throw notFound();
    return { car };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.car.name} — Garage Log` },
            { name: "description", content: loaderData.car.history.slice(0, 155) },
            { property: "og:title", content: `${loaderData.car.name} — Garage Log` },
            { property: "og:description", content: loaderData.car.history.slice(0, 155) },
            { property: "og:image", content: loaderData.car.image },
            { name: "twitter:image", content: loaderData.car.image },
          ],
        }
      : {},
  component: CarDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="font-display text-5xl mb-4">Car not found</h1>
      <Link to="/" className="text-primary underline">Back to library</Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl mb-3">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Try again
        </button>
      </div>
    );
  },
});

const fmt = (n: number) => `$${n.toLocaleString()}`;

function CarDetail() {
  const { car } = Route.useLoaderData();
  useProjects();
  const inList = projectsStore.has(car.id);

  const handleToggle = () => {
    projectsStore.toggle(car.id);
    toast.success(inList ? `Removed ${car.name} from your projects` : `Added ${car.name} to your projects`);
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-stencil uppercase tracking-wider text-muted-foreground hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to library
      </Link>

      {/* Hero image */}
      <div className="relative aspect-[16/7] rounded-xl overflow-hidden border-2 border-foreground/15 shadow-[var(--shadow-card)] mb-10">
        <img
          src={car.image}
          alt={car.name}
          width={1920}
          height={840}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 md:p-10 text-background">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-stencil text-xs uppercase bg-accent text-accent-foreground px-2 py-1 rounded">{car.type}</span>
            <span className="font-stencil text-xs uppercase bg-background/20 px-2 py-1 rounded">{car.year}</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl leading-none">{car.name}</h1>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10">
        {/* History */}
        <article>
          <p className="font-stencil text-xs uppercase tracking-[0.3em] text-primary mb-3">// the story</p>
          <h2 className="font-display text-3xl mb-5">A brief history</h2>
          <p className="text-lg leading-relaxed text-foreground/85">{car.history}</p>

          <div className="mt-8 flex items-baseline gap-3 border-t-2 border-foreground/15 pt-6">
            <span className="font-stencil text-xs uppercase text-muted-foreground">Current market value</span>
          </div>
          <div className="font-display text-5xl text-primary">{fmt(car.price)}</div>
        </article>

        {/* Project specs */}
        <aside className="bg-card border-2 border-foreground/15 rounded-xl p-6 shadow-[var(--shadow-card)] h-fit">
          <p className="font-stencil text-xs uppercase tracking-[0.3em] text-primary mb-1">// project sheet</p>
          <h2 className="font-display text-3xl mb-4">The verdict</h2>

          <div>
            <SpecRow label="Project difficulty"><Stars value={car.difficultyStars} /></SpecRow>
            <SpecRow label="Parts to find"><DifficultyBadge value={car.partsToFind} /></SpecRow>
            <SpecRow label="Cost of parts"><CostBadge value={car.costOfParts} /></SpecRow>
            <SpecRow label="Reliability"><Stars value={car.reliabilityStars} /></SpecRow>
            <SpecRow label="Mechanical difficulty"><DifficultyBadge value={car.mechanicalDifficulty} /></SpecRow>
            <SpecRow label="Electronic difficulty"><DifficultyBadge value={car.electronicDifficulty} /></SpecRow>
          </div>

          <div className="mt-5">
            <p className="font-stencil text-xs uppercase text-muted-foreground tracking-wider mb-2">Known defects</p>
            <ul className="space-y-1.5">
              {car.knownDefects.map((d) => (
                <li key={d} className="flex gap-2 text-sm">
                  <span className="text-primary font-bold">✕</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={handleToggle}
            className={`mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-md font-display text-xl tracking-wide transition-all shadow-[var(--shadow-stamp)] ${
              inList
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {inList ? (<><Check className="h-5 w-5" /> In your projects</>) : (<><Plus className="h-5 w-5" /> Add to my car projects</>)}
          </button>
        </aside>
      </div>
    </main>
  );
}
