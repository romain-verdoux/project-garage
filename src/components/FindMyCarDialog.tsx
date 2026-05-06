import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import type { Car } from "@/data/cars";
import { projectsStore } from "@/lib/projects-store";

const AD_SOURCES = [
  { id: "leboncoin", label: "Leboncoin" },
  { id: "lacentrale", label: "La Centrale" },
  { id: "autoscout24", label: "AutoScout24" },
  { id: "mobile-de", label: "Mobile.de" },
  { id: "bringatrailer", label: "Bring a Trailer" },
  { id: "ebay", label: "eBay Motors" },
];

function splitMakeModel(name: string) {
  const parts = name.split(" ");
  return { make: parts[0] ?? "", model: parts.slice(1).join(" ") };
}

export function FindMyCarDialog({ car }: { car: Car }) {
  const hasAlert = projectsStore.hasSeeking(car.id);
  const [open, setOpen] = useState(false);
  const defaults = splitMakeModel(car.name);

  const [searchName, setSearchName] = useState(car.name);
  const [make, setMake] = useState(defaults.make);
  const [model, setModel] = useState(defaults.model);
  const [year, setYear] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<number>(car.price);
  const [sources, setSources] = useState<string[]>([]);
  const [notify, setNotify] = useState<"mail" | "whatsapp" | "none">("none");

  const toggleSource = (id: string) =>
    setSources((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchName.trim() || !make.trim() || !model.trim()) {
      toast.error("Please fill in name, make and model");
      return;
    }
    projectsStore.setSeeking(car.id, {
      searchName: searchName.trim(),
      make: make.trim(),
      model: model.trim(),
      year: year.trim() || undefined,
      maxPrice,
      sources,
      notify,
      createdAt: Date.now(),
    });
    toast.success(`Alert set for "${searchName}". Added to your projects.`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-md font-display text-xl tracking-wide transition-all border-2 border-foreground/20 bg-background hover:bg-accent hover:text-accent-foreground"
        >
          <Bell className="h-5 w-5" /> {hasAlert ? `Modify the search for my ${car.name}` : `Find my ${car.name}`}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">Set up your ad alert</DialogTitle>
          <DialogDescription>
            We'll scan marketplaces and notify you when a matching {car.name} pops up.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="searchName">Name of the search</Label>
            <Input
              id="searchName"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="make">Make</Label>
              <Input id="make" value={make} onChange={(e) => setMake(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} maxLength={50} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Max price</Label>
              <span className="text-sm font-medium text-primary">${maxPrice.toLocaleString()}</span>
            </div>
            <Slider
              min={0}
              max={500000}
              step={1000}
              value={[maxPrice]}
              onValueChange={([v]) => setMaxPrice(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>$0</span>
              <span>$500,000</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="year">
              Production year <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="year"
              type="number"
              placeholder="e.g. 1967"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={1900}
              max={2100}
            />
          </div>

          <div className="space-y-2">
            <Label>Ads sources</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border-2 border-foreground/15 p-3">
              {AD_SOURCES.map((src) => (
                <label key={src.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={sources.includes(src.id)}
                    onCheckedChange={() => toggleSource(src.id)}
                  />
                  <span>{src.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Placeholder list — real sources coming soon.</p>
          </div>

          <div className="space-y-2">
            <Label>Notification system</Label>
            <div className="flex flex-wrap gap-4 rounded-md border-2 border-foreground/15 p-3">
              {[
                { id: "mail", label: "Mail" },
                { id: "whatsapp", label: "WhatsApp" },
                { id: "none", label: "Nothing" },
              ].map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={notify === opt.id}
                    onCheckedChange={() => setNotify(opt.id as typeof notify)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md font-display text-lg tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-stamp)]"
          >
            Validate
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
