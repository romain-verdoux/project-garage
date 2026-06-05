import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { Car } from "@/data/cars";
import { useAuth } from "@/hooks/useAuth";
import { deleteCarBySlug } from "@/lib/cars-public.functions";

const fmt = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;

export function CarCard({ car }: { car: Car }) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const deleteFn = useServerFn(deleteCarBySlug);
  const [deleting, setDeleting] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Remove "${car.name}" from the library?`)) return;
    setDeleting(true);
    try {
      await deleteFn({ data: { slug: car.id } });
      toast.success(`Removed ${car.name}`);
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove car");
      setDeleting(false);
    }
  };

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
        {isAdmin && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={deleting}
            aria-label={`Remove ${car.name}`}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-stencil uppercase tracking-wider shadow-[var(--shadow-stamp)] hover:bg-destructive/90 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? "Removing…" : "Remove"}
          </button>
        )}
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
