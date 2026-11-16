import { useSyncExternalStore } from 'react';
import { emptyProgress, localStore } from './progress';
import type { Progress } from './types';

let state: Progress = localStore.load() ?? emptyProgress();
const listeners = new Set<() => void>();

export function getProgress(): Progress {
  return state;
}

export function setProgress(next: Progress | ((p: Progress) => Progress)): void {
  state = typeof next === 'function' ? next(state) : next;
  localStore.save(state);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress);
}
