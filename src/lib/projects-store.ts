// Local "My Car Projects" store backed by localStorage with subscription.
const KEY = "my-car-projects-v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
  listeners.forEach((l) => l());
}

export const projectsStore = {
  getAll: read,
  has: (id: string) => read().includes(id),
  add: (id: string) => {
    const cur = read();
    if (!cur.includes(id)) write([...cur, id]);
  },
  remove: (id: string) => write(read().filter((x) => x !== id)),
  toggle: (id: string) => {
    const cur = read();
    write(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  },
  subscribe: (l: Listener) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

import { useSyncExternalStore } from "react";
export function useProjects() {
  return useSyncExternalStore(
    (cb) => projectsStore.subscribe(cb),
    () => JSON.stringify(projectsStore.getAll()),
    () => "[]",
  );
}
