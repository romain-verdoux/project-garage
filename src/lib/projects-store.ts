// Local "My Car Projects" store backed by localStorage with subscription.
// Single unified list of projects. Each project may optionally have a "seeking" alert.
import { useSyncExternalStore } from "react";

const KEY = "my-car-projects-v3";
const LEGACY_KEYS = ["my-car-projects-v2", "my-car-projects-v1"];

export type SeekingAlert = {
  searchName: string;
  make: string;
  model: string;
  year?: string;
  maxPrice?: number;
  sources: string[];
  notify: "mail" | "whatsapp" | "none";
  createdAt: number;
};

export type ProjectsState = {
  // car id -> seeking alert (or null if added without alert)
  projects: Record<string, SeekingAlert | null>;
};

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): ProjectsState {
  if (typeof window === "undefined") return { projects: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        projects:
          parsed.projects && typeof parsed.projects === "object" ? parsed.projects : {},
      };
    }
    // migrate from v2
    const v2 = localStorage.getItem("my-car-projects-v2");
    if (v2) {
      const parsed = JSON.parse(v2);
      const projects: Record<string, SeekingAlert | null> = {};
      if (Array.isArray(parsed.project)) parsed.project.forEach((id: string) => (projects[id] = null));
      if (parsed.seeking && typeof parsed.seeking === "object") {
        Object.entries(parsed.seeking).forEach(([id, alert]) => {
          projects[id] = alert as SeekingAlert;
        });
      }
      return { projects };
    }
    // migrate from v1
    const v1 = localStorage.getItem("my-car-projects-v1");
    if (v1) {
      const ids = JSON.parse(v1);
      if (Array.isArray(ids)) {
        const projects: Record<string, SeekingAlert | null> = {};
        ids.forEach((id) => (projects[id] = null));
        return { projects };
      }
    }
  } catch {
    // ignore
  }
  return { projects: {} };
}

function write(state: ProjectsState) {
  localStorage.setItem(KEY, JSON.stringify(state));
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  listeners.forEach((l) => l());
}

export const projectsStore = {
  getAll: read,
  has: (id: string) => id in read().projects,
  hasSeeking: (id: string) => Boolean(read().projects[id]),
  getSeeking: (id: string) => read().projects[id] ?? null,
  add: (id: string) => {
    const cur = read();
    if (!(id in cur.projects)) {
      write({ projects: { ...cur.projects, [id]: null } });
    }
  },
  remove: (id: string) => {
    const cur = read();
    const { [id]: _drop, ...rest } = cur.projects;
    write({ projects: rest });
  },
  setSeeking: (id: string, alert: SeekingAlert) => {
    const cur = read();
    write({ projects: { ...cur.projects, [id]: alert } });
  },
  clearSeeking: (id: string) => {
    const cur = read();
    if (id in cur.projects) {
      write({ projects: { ...cur.projects, [id]: null } });
    }
  },
  subscribe: (l: Listener) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useProjects() {
  return useSyncExternalStore(
    (cb) => projectsStore.subscribe(cb),
    () => JSON.stringify(projectsStore.getAll()),
    () => "{}",
  );
}
