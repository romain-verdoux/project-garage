// Local "My Car Projects" store backed by localStorage with subscription.
// Two lists: "project" (cars added to restore) and "seeking" (alerts set).
import { useSyncExternalStore } from "react";

const KEY = "my-car-projects-v2";
const LEGACY_KEY = "my-car-projects-v1";

export type SeekingAlert = {
  searchName: string;
  make: string;
  model: string;
  year?: string;
  sources: string[];
  notify: "mail" | "whatsapp" | "none";
  createdAt: number;
};

export type ProjectsState = {
  project: string[]; // car ids
  seeking: Record<string, SeekingAlert>; // car id -> alert
};

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): ProjectsState {
  if (typeof window === "undefined") return { project: [], seeking: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        project: Array.isArray(parsed.project) ? parsed.project : [],
        seeking: parsed.seeking && typeof parsed.seeking === "object" ? parsed.seeking : {},
      };
    }
    // migrate from v1
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const ids = JSON.parse(legacy);
      if (Array.isArray(ids)) return { project: ids, seeking: {} };
    }
  } catch {
    // ignore
  }
  return { project: [], seeking: {} };
}

function write(state: ProjectsState) {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export const projectsStore = {
  getAll: read,
  // project list
  has: (id: string) => read().project.includes(id),
  add: (id: string) => {
    const cur = read();
    if (!cur.project.includes(id)) write({ ...cur, project: [...cur.project, id] });
  },
  remove: (id: string) => {
    const cur = read();
    write({ ...cur, project: cur.project.filter((x) => x !== id) });
  },
  toggle: (id: string) => {
    const cur = read();
    const next = cur.project.includes(id)
      ? cur.project.filter((x) => x !== id)
      : [...cur.project, id];
    write({ ...cur, project: next });
  },
  // seeking list
  hasSeeking: (id: string) => Boolean(read().seeking[id]),
  addSeeking: (id: string, alert: SeekingAlert) => {
    const cur = read();
    write({ ...cur, seeking: { ...cur.seeking, [id]: alert } });
  },
  removeSeeking: (id: string) => {
    const cur = read();
    const { [id]: _drop, ...rest } = cur.seeking;
    write({ ...cur, seeking: rest });
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
