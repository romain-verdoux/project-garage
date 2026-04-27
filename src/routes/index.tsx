import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cars, CAR_TYPES, PRICE_BUCKETS, DECADES, type CarType, type Decade } from "@/data/cars";
import { CarCard } from "@/components/CarCard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import heroImg from "@/assets/hero-garage.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Car Library — Garage Log" },
      { name: "description", content: "Browse the library of car projects. Filter by type, price and decade." },
    ],
  }),
  component: LibraryPage,
});

function FilterDropdown<T extends string>({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: readonly { id: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  const count = selected.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md border-2 text-sm font-medium transition-colors ${
            count > 0
              ? "bg-primary text-primary-foreground border-primary shadow-[var(--shadow-stamp)]"
              : "bg-card border-foreground/15 hover:border-primary"
          }`}
        >
          <span className="font-stencil uppercase tracking-wider text-xs">{title}</span>
          {count > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-background/20 text-xs font-bold">
              {count}
            </span>
          )}
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2 bg-card border-2 border-foreground/15">
        <div className="space-y-1">
          {options.map((o) => {
            const active = selected.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => onToggle(o.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <span>{o.label}</span>
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LibraryPage() {
  const [types, setTypes] = useState<CarType[]>([]);
  const [prices, setPrices] = useState<string[]>([]);
  const [decades, setDecades] = useState<Decade[]>([]);

  const toggle = <T,>(arr: T[], setArr: (v: T[]) => void, v: T) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const filtered = useMemo(() => {
    return cars.filter((c) => {
      if (types.length && !types.includes(c.type)) return false;
      if (decades.length && !decades.includes(c.decade)) return false;
      if (prices.length) {
        const ok = prices.some((pid) => {
          const b = PRICE_BUCKETS.find((x) => x.id === pid);
          return b && c.price >= b.min && c.price < b.max;
        });
        if (!ok) return false;
      }
      return true;
    });
  }, [types, prices, decades]);

  const clearAll = () => {
    setTypes([]);
    setPrices([]);
    setDecades([]);
  };
  const hasFilters = types.length + prices.length + decades.length > 0;

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden border-b-2 border-foreground/15">
        <img
          src={heroImg}
          alt="Vintage garage"
          width={1920}
          height={1024}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/85 via-foreground/60 to-foreground/30" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 md:py-28">
          <p className="font-stencil text-xs uppercase tracking-[0.3em] text-accent mb-3">// the project library</p>
          <h1 className="font-display text-5xl md:text-7xl text-background max-w-3xl leading-[0.95]">
            Find your next<br />restoration project.
          </h1>
          <p className="mt-5 text-background/80 max-w-xl">
            Curated cars with the truth about parts, costs and headaches — so you know
            what you're signing up for before the first bolt comes loose.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        {/* Horizontal filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-8 pb-6 border-b-2 border-foreground/15">
          <h2 className="font-display text-2xl mr-2">Filters</h2>
          <FilterDropdown
            title="Body type"
            options={CAR_TYPES.map((t) => ({ id: t, label: t }))}
            selected={types}
            onToggle={(v) => toggle(types, setTypes, v)}
          />
          <FilterDropdown
            title="Price"
            options={PRICE_BUCKETS.map((b) => ({ id: b.id, label: b.label }))}
            selected={prices}
            onToggle={(v) => toggle(prices, setPrices, v)}
          />
          <FilterDropdown
            title="Decade"
            options={DECADES.map((d) => ({ id: d, label: `'${d}` }))}
            selected={decades}
            onToggle={(v) => toggle(decades, setDecades, v)}
          />
          {hasFilters && (
            <button
              onClick={clearAll}
              className="ml-auto text-xs font-stencil uppercase text-primary hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Results */}
        <div>
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-display text-3xl">
              {filtered.length} {filtered.length === 1 ? "car" : "cars"}
            </h2>
            <span className="font-stencil text-xs uppercase text-muted-foreground">sorted by curator's pick</span>
          </div>
          {filtered.length === 0 ? (
            <div className="border-2 border-dashed border-foreground/20 rounded-lg p-12 text-center">
              <p className="font-display text-2xl mb-2">No cars match those filters</p>
              <p className="text-muted-foreground">Try clearing some filters to widen the search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((c) => (
                <CarCard key={c.id} car={c} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
