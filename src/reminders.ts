import { dayIndex } from './engine/dates';
import type { Progress } from './engine/types';

/**
 * Напоминания без сервера:
 *  1. пока приложение открыто — таймер на выбранное время;
 *  2. в установленном PWA на Android/Chrome — Periodic Background Sync;
 *  3. везде — файл календаря (.ics) с ежедневным событием.
 * Гарантированные push-уведомления на закрытое приложение требуют
 * серверной части (Web Push); её здесь нет.
 */

const DB = 'kamerton';
const STORE = 'kv';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Service worker не видит localStorage — кладём ему нужное в IndexedDB. */
export async function publishReminderState(p: Progress): Promise<void> {
  if (!('indexedDB' in window)) return;
  try {
    const d = await db();
    const today = dayIndex();
    const practicedToday = (p.days[new Date(today * 86400000).toISOString().slice(0, 10)]?.n ?? 0) > 0;
    d.transaction(STORE, 'readwrite').objectStore(STORE).put(
      { enabled: p.settings.reminder, time: p.settings.reminderTime, lastPractice: practicedToday ? today : null },
      'reminder',
    );
  } catch {
    /* напоминания не критичны */
  }
}

export function notificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export async function enableReminders(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  try {
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: { register(tag: string, opts: { minInterval: number }): Promise<void> };
    };
    await reg.periodicSync?.register('daily-reminder', { minInterval: 12 * 60 * 60 * 1000 });
  } catch {
    /* Periodic Background Sync доступен не везде */
  }
  return 'granted';
}

let timer = 0;

/** Таймер на сегодня: сработает, если приложение открыто и занятия ещё не было. */
export function scheduleInApp(p: Progress, practicedToday: () => boolean): void {
  window.clearTimeout(timer);
  if (!p.settings.reminder || !notificationsSupported() || Notification.permission !== 'granted') return;
  const [h, m] = p.settings.reminderTime.split(':').map(Number);
  const at = new Date();
  at.setHours(h, m, 0, 0);
  const wait = at.getTime() - Date.now();
  if (wait <= 0) return;
  timer = window.setTimeout(async () => {
    if (practicedToday()) return;
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('Камертон', {
      body: 'Десять фрагментов — и серия продолжится.',
      icon: `${import.meta.env.BASE_URL}icon-192.png`,
      badge: `${import.meta.env.BASE_URL}icon-192.png`,
      tag: 'daily-reminder',
    });
  }, wait);
}

/** Ежедневное событие для любого календаря. */
export function reminderIcs(time: string, url: string): string {
  const [h, m] = time.split(':');
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kamerton//RU',
    'BEGIN:VEVENT',
    `UID:kamerton-daily-${ymd}@kamerton`,
    `DTSTAMP:${ymd}T000000Z`,
    `DTSTART:${ymd}T${h}${m}00`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:Камертон: занятие на слух',
    `DESCRIPTION:Десять фрагментов классики. ${url}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Камертон: пора заниматься',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
