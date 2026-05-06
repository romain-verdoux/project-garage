import mustang from "@/assets/car-mustang.jpg";
import porsche from "@/assets/car-911.jpg";
import e30 from "@/assets/car-e30.jpg";
import pagoda from "@/assets/car-pagoda.jpg";
import volvo from "@/assets/car-volvo.jpg";
import golf from "@/assets/car-golf.jpg";
import rs4 from "@/assets/car-rs4.jpg";
import belair from "@/assets/car-belair.jpg";

export type CarType = "Coupé" | "Sedan" | "Cabriolet" | "Wagon" | "Hatchback";
export type Decade = "20s" | "10s" | "00s" | "90s" | "80s" | "70s" | "60s" | "50s";
export type Difficulty = "easy" | "medium" | "hard" | "extreme";
export type CostLevel = "low" | "medium" | "high" | "extreme";

export type Car = {
  id: string;
  name: string;
  make: string;
  image: string;
  type: CarType;
  price: number; // USD market value
  year: number;
  decade: Decade;
  history: string;
  difficultyStars: 1 | 2 | 3 | 4 | 5;
  partsToFind: Difficulty;
  costOfParts: CostLevel;
  reliabilityStars: 1 | 2 | 3 | 4 | 5;
  mechanicalDifficulty: Difficulty;
  electronicDifficulty: Difficulty;
  knownDefects: string[];
};

export const CAR_TYPES: CarType[] = ["Coupé", "Sedan", "Cabriolet", "Wagon", "Hatchback"];

export const PRICE_BUCKETS = [
  { id: "u10", label: "Under $10k", min: 0, max: 10_000 },
  { id: "10-25", label: "$10k – $25k", min: 10_000, max: 25_000 },
  { id: "25-50", label: "$25k – $50k", min: 25_000, max: 50_000 },
  { id: "50-100", label: "$50k – $100k", min: 50_000, max: 100_000 },
  { id: "a100", label: "Above $100k", min: 100_000, max: Infinity },
] as const;

export const DECADES: Decade[] = ["20s", "10s", "00s", "90s", "80s", "70s", "60s", "50s"];

export const cars: Car[] = [
  {
    id: "mustang-67",
    name: "Ford Mustang Fastback",
    make: "Ford",
    image: mustang,
    type: "Coupé",
    price: 65_000,
    year: 1967,
    decade: "60s",
    history:
      "Launched in 1964, the Ford Mustang single-handedly created the pony car segment. The 1967 fastback widened its stance, swallowed bigger V8s and starred in countless films — most famously chased through the streets of San Francisco. Today, a 1967 fastback is the archetypal American muscle restoration project, beloved for its cavernous engine bay and forgiving sheetmetal.",
    difficultyStars: 3,
    partsToFind: "easy",
    costOfParts: "medium",
    reliabilityStars: 4,
    mechanicalDifficulty: "easy",
    electronicDifficulty: "easy",
    knownDefects: ["Floor pan rust", "Torque box cracks", "Worn front suspension bushings", "Leaky rear axle seals"],
  },
  {
    id: "porsche-911-72",
    name: "Porsche 911 T",
    image: porsche,
    type: "Coupé",
    price: 120_000,
    year: 1972,
    decade: "70s",
    history:
      "The 1972 Porsche 911 — the famous '2.4' year — introduced a longer wheelbase variant and the short-lived external oil filler. Hand-built in Stuttgart, every long-hood 911 is a precision instrument: light, balanced, and uncompromising. Restorations are rewarding but unforgiving — the air-cooled flat-six demands respect.",
    difficultyStars: 5,
    partsToFind: "hard",
    costOfParts: "extreme",
    reliabilityStars: 4,
    mechanicalDifficulty: "hard",
    electronicDifficulty: "easy",
    knownDefects: ["Hell hole rust (battery box)", "Worn valve guides", "Chain tensioner failure", "Faded interior plastics"],
  },
  {
    id: "bmw-e30",
    name: "BMW 325i (E30)",
    image: e30,
    type: "Sedan",
    price: 22_000,
    year: 1985,
    decade: "80s",
    history:
      "The E30 generation 3 Series defined the sport sedan formula: rear-wheel drive, near-perfect weight distribution and a free-revving inline-six. Built from 1982 to 1994, it became the canvas for everything from track builds to drift weapons. Parts support is excellent and the chassis tolerates almost any modification.",
    difficultyStars: 2,
    partsToFind: "easy",
    costOfParts: "medium",
    reliabilityStars: 5,
    mechanicalDifficulty: "easy",
    electronicDifficulty: "medium",
    knownDefects: ["Subframe mount cracks", "Cooling system age-out", "Cracked dashboards", "Worn shifter bushings"],
  },
  {
    id: "pagoda-65",
    name: "Mercedes-Benz 230 SL Pagoda",
    image: pagoda,
    type: "Cabriolet",
    price: 145_000,
    year: 1965,
    decade: "60s",
    history:
      "Designed by Paul Bracq, the W113 'Pagoda' replaced both the 190 SL and the legendary 300 SL with elegance and engineering substance. Its concave hardtop gave it a name and its inline-six gave it character. Today it's a blue-chip classic — restoration costs match the prestige.",
    difficultyStars: 5,
    partsToFind: "hard",
    costOfParts: "extreme",
    reliabilityStars: 4,
    mechanicalDifficulty: "hard",
    electronicDifficulty: "easy",
    knownDefects: ["Sill and floor rust", "Bosch injection pump wear", "Soft-top frame seizure", "Chrome pitting"],
  },
  {
    id: "volvo-240",
    name: "Volvo 240 Wagon",
    image: volvo,
    type: "Wagon",
    price: 9_500,
    year: 1990,
    decade: "90s",
    history:
      "Few cars symbolize Swedish over-engineering like the Volvo 240. Produced almost unchanged for nearly two decades, its boxy silhouette hides a redblock four that famously refuses to die. A wagon is the ultimate cheap, weird, characterful project car.",
    difficultyStars: 1,
    partsToFind: "easy",
    costOfParts: "low",
    reliabilityStars: 5,
    mechanicalDifficulty: "easy",
    electronicDifficulty: "easy",
    knownDefects: ["Rear axle bushings", "Flame trap blockage", "Leaky overdrive solenoid", "Fuel pump relay failure"],
  },
  {
    id: "golf-gti-mk3",
    name: "Volkswagen Golf GTI Mk3",
    image: golf,
    type: "Hatchback",
    price: 8_000,
    year: 1995,
    decade: "90s",
    history:
      "The Mk3 GTI is often the underdog of the Golf lineage, but its 2.0L 8v and later VR6 made it a cult favorite. Affordable, plentiful and easy to wrench on, it's the perfect entry-level European hot hatch project.",
    difficultyStars: 2,
    partsToFind: "easy",
    costOfParts: "low",
    reliabilityStars: 3,
    mechanicalDifficulty: "easy",
    electronicDifficulty: "medium",
    knownDefects: ["Window regulator failure", "Coolant flange cracks", "Wiring harness chafing", "Sunroof drains clog"],
  },
  {
    id: "audi-rs4-b7",
    name: "Audi RS4 (B7)",
    image: rs4,
    type: "Sedan",
    price: 42_000,
    year: 2007,
    decade: "00s",
    history:
      "The B7 RS4 is the last naturally aspirated RS sedan: a 4.2L V8 howling to 8,250 rpm, paired with quattro and a six-speed manual. A modern classic in the making, but its complexity makes restoration a serious commitment.",
    difficultyStars: 4,
    partsToFind: "medium",
    costOfParts: "high",
    reliabilityStars: 3,
    mechanicalDifficulty: "hard",
    electronicDifficulty: "hard",
    knownDefects: ["Carbon buildup on intake valves", "DRC suspension leaks", "Cam follower wear", "Rear differential whine"],
  },
  {
    id: "belair-58",
    name: "Chevrolet Bel Air",
    make: "Chevrolet",
    image: belair,
    type: "Coupé",
    price: 55_000,
    year: 1958,
    decade: "50s",
    history:
      "Chrome, fins and small-block V8 ambition — the Bel Air is rolling Americana. The 1958 model marked a one-year-only design with quad headlights and sculpted flanks. Restoring one is a labor of love, and a lesson in mid-century body craftsmanship.",
    difficultyStars: 4,
    partsToFind: "medium",
    costOfParts: "high",
    reliabilityStars: 4,
    mechanicalDifficulty: "medium",
    electronicDifficulty: "easy",
    knownDefects: ["Lower quarter panel rust", "Trunk floor pitting", "Brake master cylinder leaks", "Chrome trim corrosion"],
  },
];

export const getCar = (id: string) => cars.find((c) => c.id === id);
