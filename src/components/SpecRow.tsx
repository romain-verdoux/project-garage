import { Star } from "lucide-react";
import type { Difficulty } from "@/data/cars";

export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < value ? "fill-primary text-primary" : "text-foreground/20"}`}
        />
      ))}
    </div>
  );
}

const difficultyMap: Record<Difficulty, { label: string; color: string }> = {
  easy: { label: "Easy", color: "bg-emerald-600/15 text-emerald-800 border-emerald-700/30" },
  medium: { label: "Medium", color: "bg-amber-600/15 text-amber-800 border-amber-700/30" },
  hard: { label: "Hard", color: "bg-orange-600/20 text-orange-900 border-orange-700/40" },
  extreme: { label: "Extreme", color: "bg-red-700/15 text-red-800 border-red-800/40" },
};

const costMap: Record<Difficulty, { label: string; color: string }> = {
  easy: { label: "Low", color: "bg-emerald-600/15 text-emerald-800 border-emerald-700/30" },
  medium: { label: "Medium", color: "bg-amber-600/15 text-amber-800 border-amber-700/30" },
  hard: { label: "High", color: "bg-orange-600/20 text-orange-900 border-orange-700/40" },
  extreme: { label: "Extreme", color: "bg-red-700/15 text-red-800 border-red-800/40" },
};

export function DifficultyBadge({ value, kind = "difficulty" }: { value: Difficulty; kind?: "difficulty" | "cost" }) {
  const m = (kind === "cost" ? costMap : difficultyMap)[value];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${m.color}`}>
      {m.label}
    </span>
  );
}

export function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-dashed border-foreground/15 last:border-b-0">
      <span className="font-stencil text-xs uppercase text-muted-foreground tracking-wider">{label}</span>
      <div>{children}</div>
    </div>
  );
}
