import { ExternalLink } from "lucide-react";
import type { SeekingAlert } from "@/lib/projects-store";

type Marketplace = {
  id: string;
  label: string;
  icon: string;
  buildUrl: (alert: SeekingAlert) => string;
};

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const MARKETPLACES: Marketplace[] = [
  {
    id: "leboncoin",
    label: "Leboncoin",
    icon: "🟧",
    buildUrl: (a) => {
      const params = new URLSearchParams();
      params.set("category", "2"); // Voitures
      params.set("text", `${a.make} ${a.model}`);
      if (a.maxPrice) params.set("price", `min-${a.maxPrice}`);
      return `https://www.leboncoin.fr/recherche?${params.toString()}`;
    },
  },
  {
    id: "leparking",
    label: "Le Parking",
    icon: "🅿️",
    buildUrl: (a) => {
      const slug = slugify(`${a.make} ${a.model}`);
      let url = `https://www.leparking.fr/voiture-occasion/${slug}.html`;
      const params: string[] = [];
      if (a.maxPrice) params.push(`prix-${a.maxPrice}`);
      if (a.year) params.push(`annee-${a.year}`);
      if (params.length) url += `?${params.join("&")}`;
      return url;
    },
  },
  {
    id: "lacentrale",
    label: "La Centrale",
    icon: "🔵",
    buildUrl: (a) => {
      const params = new URLSearchParams();
      params.set(
        "makesModelsCommercialNames",
        `${a.make.toUpperCase()}:${a.model.toUpperCase()}`,
      );
      if (a.maxPrice) params.set("priceMax", String(a.maxPrice));
      if (a.year) {
        params.set("yearMin", a.year);
        params.set("yearMax", a.year);
      }
      return `https://www.lacentrale.fr/listing?${params.toString()}`;
    },
  },
  {
    id: "autoscout24",
    label: "AutoScout24",
    icon: "🟡",
    buildUrl: (a) => {
      const make = slugify(a.make);
      const model = slugify(a.model);
      const params = new URLSearchParams();
      if (a.maxPrice) params.set("priceto", String(a.maxPrice));
      if (a.year) {
        params.set("fregfrom", a.year);
        params.set("fregto", a.year);
      }
      const qs = params.toString();
      return `https://www.autoscout24.fr/lst/${make}/${model}${qs ? `?${qs}` : ""}`;
    },
  },
  {
    id: "mobile-de",
    label: "Mobile.de",
    icon: "🟢",
    buildUrl: (a) => {
      const params = new URLSearchParams();
      params.set("q", `${a.make} ${a.model}`);
      if (a.maxPrice) params.set("p", `:${a.maxPrice}`);
      if (a.year) params.set("fr", `${a.year}:${a.year}`);
      return `https://suchen.mobile.de/fahrzeuge/search.html?${params.toString()}`;
    },
  },
  {
    id: "bringatrailer",
    label: "Bring a Trailer",
    icon: "🏁",
    buildUrl: (a) => {
      const q = encodeURIComponent(`${a.make} ${a.model}`);
      return `https://bringatrailer.com/search/?q=${q}`;
    },
  },
];

export function MarketplaceLinks({ alert }: { alert: SeekingAlert }) {
  return (
    <div className="mt-6 border-2 border-foreground/15 rounded-xl p-5 bg-card shadow-[var(--shadow-card)]">
      <p className="font-stencil text-xs uppercase tracking-[0.3em] text-primary mb-1">
        // browse listings
      </p>
      <h3 className="font-display text-2xl mb-1">Search on marketplaces</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Pre-filled with your criteria — click to see matching ads.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MARKETPLACES.map((mp) => {
          const url = mp.buildUrl(alert);
          return (
            <a
              key={mp.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-foreground/10 bg-background hover:border-primary hover:shadow-[var(--shadow-stamp)] transition-all group"
            >
              <span className="text-xl">{mp.icon}</span>
              <span className="flex-1 font-medium text-sm group-hover:text-primary transition-colors">
                {mp.label}
              </span>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {alert.make} {alert.model}
        {alert.maxPrice ? ` · up to $${alert.maxPrice.toLocaleString()}` : ""}
        {alert.year ? ` · ${alert.year}` : ""}
      </p>
    </div>
  );
}
