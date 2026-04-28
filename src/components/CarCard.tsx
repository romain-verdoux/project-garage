import { Link } from "@tanstack/react-router";
import type { Car } from "@/data/cars";

const fmt = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;

export function CarCard({ car }: { car: Car }) {
  return (
    <Link
      to="/library/$carId"
      params={{ carId: car.id }}
      className="group block bg-card border-2 border-foreground/10 rounded-lg overflow-hidden shadow-[var(--shadow-card)] hover:-translate-y-1 hover:border-primary transition-all duration-300"
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-muted">
        <img
          src={car.image}
          alt={car.name}
          loading="lazy"
          width={1024}
          height={768}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <span className="absolute top-3 left-3 font-stencil text-xs uppercase bg-foreground text-background px-2 py-1 rounded">
          {car.type}
        </span>
        <span className="absolute top-3 right-3 font-display text-sm bg-accent text-accent-foreground px-2 py-1 rounded shadow-[var(--shadow-stamp)]">
          '{String(car.year).slice(-2)}
        </span>
      </div>
      <div className="p-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl leading-tight truncate">{car.name}</h3>
          <p className="font-stencil text-xs text-muted-foreground uppercase">Market value</p>
        </div>
        <div className="font-display text-2xl text-primary whitespace-nowrap">{fmt(car.price)}</div>
      </div>
    </Link>
  );
}
