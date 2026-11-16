/** Номер локального дня (дни от эпохи в часовом поясе пользователя). */
export function dayIndex(d: Date = new Date()): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

export function dayKey(index: number): string {
  return new Date(index * 86400000).toISOString().slice(0, 10);
}
