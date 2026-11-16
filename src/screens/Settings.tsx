import { useRef, useState } from 'react';
import { COMPOSERS, PIECES, composerOf } from '../data/catalog';
import { emptyProgress, normalize } from '../engine/progress';
import { getProgress, setProgress, useProgress } from '../engine/store';
import { enableReminders, notificationsSupported, reminderIcs } from '../reminders';
import { IconBack, IconChevron } from '../ui/icons';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function licenseUrl(name: string, fallback: string): string {
  const cc = /^CC BY(-SA)? (\d+(?:\.\d+)?)(?: (de))?$/i.exec(name);
  if (!cc) return fallback;
  return `https://creativecommons.org/licenses/by${cc[1] ? '-sa' : ''}/${cc[2]}/${cc[3] ? `${cc[3]}/` : ''}`;
}

export function Settings({ toCredits }: { toCredits: () => void }) {
  const p = useProgress();
  const [toast, setToast] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const say = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(''), 3200);
  };
  const patch = (s: Partial<typeof p.settings>) => setProgress((st) => ({ ...st, settings: { ...st.settings, ...s } }));

  const toggleReminder = async () => {
    if (p.settings.reminder) return patch({ reminder: false });
    const res = await enableReminders();
    if (res === 'granted') {
      patch({ reminder: true });
      say('Напоминания включены');
    } else if (res === 'denied') say('Уведомления запрещены в настройках браузера');
    else say('Этот браузер не поддерживает уведомления — используйте календарь');
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const next = normalize(JSON.parse(await f.text()));
      if (!next) throw new Error('bad');
      setProgress(next);
      say('Прогресс загружен');
    } catch {
      say('Не удалось прочитать файл');
    }
  };

  return (
    <div className="screen">
      <div className="topbar">
        <h1>Настройки</h1>
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Цель на день
      </div>
      <div className="seg" role="radiogroup" aria-label="Цель на день">
        {[10, 20, 30].map((n) => (
          <button key={n} role="radio" aria-checked={p.settings.dailyGoal === n} className={p.settings.dailyGoal === n ? 'on' : ''} onClick={() => patch({ dailyGoal: n })}>
            {n} ответов
          </button>
        ))}
      </div>

      <div className="section-title">
        <span className="eyebrow">Напоминания</span>
      </div>
      <div className="list">
        <div className="field">
          <div>
            <div style={{ fontWeight: 580 }}>Напоминать о занятии</div>
            <div className="small muted">Если сегодня ещё не занимались</div>
          </div>
          <button className={`switch ${p.settings.reminder ? 'on' : ''}`} role="switch" aria-checked={p.settings.reminder} aria-label="Напоминать о занятии" onClick={toggleReminder} />
        </div>
        <div className="field">
          <label htmlFor="rtime" style={{ fontWeight: 580 }}>
            Время
          </label>
          <input id="rtime" type="time" value={p.settings.reminderTime} onChange={(e) => e.target.value && patch({ reminderTime: e.target.value })} />
        </div>
        <button className="field item" onClick={() => download('kamerton.ics', reminderIcs(p.settings.reminderTime, `${location.origin}${import.meta.env.BASE_URL}`), 'text/calendar')}>
          <div className="grow">
            <div style={{ fontWeight: 580 }}>Добавить в календарь</div>
            <div className="small muted">Ежедневное событие — сработает на любом устройстве</div>
          </div>
          <IconChevron style={{ color: 'var(--faint)' }} />
        </button>
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        {notificationsSupported()
          ? 'Уведомление приходит, когда приложение открыто или установлено на Android. На iPhone надёжнее событие в календаре.'
          : 'Этот браузер не показывает уведомления от сайтов — используйте событие в календаре.'}
      </p>

      <div className="section-title">
        <span className="eyebrow">Данные</span>
      </div>
      <div className="list">
        <button className="field item" onClick={() => download('kamerton-progress.json', JSON.stringify(getProgress()), 'application/json')}>
          <div className="grow">
            <div style={{ fontWeight: 580 }}>Сохранить прогресс в файл</div>
            <div className="small muted">Прогресс хранится на этом устройстве</div>
          </div>
          <IconChevron style={{ color: 'var(--faint)' }} />
        </button>
        <button className="field item" onClick={() => file.current?.click()}>
          <div className="grow" style={{ fontWeight: 580 }}>
            Загрузить прогресс из файла
          </div>
          <IconChevron style={{ color: 'var(--faint)' }} />
        </button>
        <button className="field item" onClick={toCredits}>
          <div className="grow">
            <div style={{ fontWeight: 580 }}>Записи и лицензии</div>
            <div className="small muted">Исполнители и источники всех {PIECES.length} записей</div>
          </div>
          <IconChevron style={{ color: 'var(--faint)' }} />
        </button>
      </div>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => (onImport(e.target.files?.[0]), (e.target.value = ''))} />

      <div style={{ marginTop: 22 }}>
        {confirmReset ? (
          <div className="card stack">
            <p>Стереть весь прогресс на этом устройстве? Отменить это нельзя.</p>
            <div className="row">
              <button className="btn compact" onClick={() => setConfirmReset(false)}>
                Отмена
              </button>
              <button
                className="btn compact danger"
                onClick={() => {
                  setProgress(emptyProgress());
                  setConfirmReset(false);
                  say('Прогресс сброшен');
                }}
              >
                Стереть
              </button>
            </div>
          </div>
        ) : (
          <button className="btn compact danger" onClick={() => setConfirmReset(true)}>
            Сбросить прогресс
          </button>
        )}
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export function Credits({ back }: { back: () => void }) {
  return (
    <div className="screen no-tabs">
      <div className="topbar">
        <button className="icon-btn" onClick={back} aria-label="Назад">
          <IconBack />
        </button>
        <h1>Записи и лицензии</h1>
      </div>
      <p className="note" style={{ marginBottom: 14 }}>
        Сами произведения — общественное достояние. Записи взяты с Wikimedia Commons: они либо тоже в общественном достоянии, либо распространяются по свободным лицензиям Creative Commons. В приложении звучат фрагменты без изменений.
      </p>
      {COMPOSERS.map((c) => {
        const list = PIECES.filter((x) => x.composer === c.id);
        if (!list.length) return null;
        return (
          <div key={c.id}>
            <div className="section-title" style={{ marginTop: 18 }}>
              <span className="eyebrow">{c.full}</span>
            </div>
            <div className="list">
              {list.map((x) => (
                <div className="item" key={x.id} style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="t">
                      {x.title}
                      {x.part ? ` — ${x.part}` : ''}
                    </div>
                    <div className="s">
                      {composerOf(x.composer).name}. Исполнение: {x.rec.artist || 'не указано'}. Лицензия:{' '}
                      <a href={licenseUrl(x.rec.license, x.rec.page)} target="_blank" rel="noreferrer">
                        {x.rec.license}
                      </a>.{' '}
                      <a href={x.rec.page} target="_blank" rel="noreferrer">
                        Источник
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
