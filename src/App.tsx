import { useCallback, useEffect, useState } from 'react';
import { dayIndex } from './engine/dates';
import { player } from './engine/player';
import { todayLog } from './engine/progress';
import { getProgress, useProgress } from './engine/store';
import type { Mode } from './engine/types';
import { publishReminderState, scheduleInApp } from './reminders';
import { Home } from './screens/Home';
import { Library } from './screens/Library';
import { Composers, Eras, Weak } from './screens/Pickers';
import { Quiz, type Summary } from './screens/Quiz';
import { Result } from './screens/Result';
import { Credits, Settings } from './screens/Settings';
import { Stats } from './screens/Stats';
import { IconBook, IconChart, IconGear, IconHome } from './ui/icons';

type Tab = 'home' | 'library' | 'stats' | 'settings';
type Route =
  | { name: Tab }
  | { name: 'eras' | 'composers' | 'weak' | 'credits' }
  | { name: 'quiz'; mode: Mode; run: number }
  | { name: 'result'; mode: Mode; summary: Summary };

const TABS: { id: Tab; label: string; icon: typeof IconHome }[] = [
  { id: 'home', label: 'Главная', icon: IconHome },
  { id: 'library', label: 'Библиотека', icon: IconBook },
  { id: 'stats', label: 'Прогресс', icon: IconChart },
  { id: 'settings', label: 'Настройки', icon: IconGear },
];
const isTab = (n: string): n is Tab => TABS.some((t) => t.id === n);

export function App() {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const route = stack[stack.length - 1];
  const progress = useProgress();

  // Кнопка «назад» в браузере и на Android возвращает на предыдущий экран.
  const push = useCallback((r: Route) => {
    player.stop();
    history.pushState({ depth: 1 }, '');
    setStack((s) => [...s, r]);
    window.scrollTo(0, 0);
  }, []);
  const replace = useCallback((r: Route) => {
    player.stop();
    setStack((s) => [...s.slice(0, -1), r]);
    window.scrollTo(0, 0);
  }, []);
  const back = useCallback(() => history.back(), []);
  const tab = useCallback((id: Tab) => {
    player.stop();
    setStack([{ name: id }]);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onPop = () => {
      player.stop();
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    publishReminderState(progress);
    scheduleInApp(progress, () => todayLog(getProgress(), dayIndex()).n > 0);
  }, [progress]);

  const start = useCallback(
    (mode: Mode) => {
      player.unlock(); // звук должен быть разрешён тем же нажатием
      push({ name: 'quiz', mode, run: Date.now() });
    },
    [push],
  );

  let body: React.ReactNode;
  switch (route.name) {
    case 'home':
      body = <Home start={start} go={(name) => push({ name })} />;
      break;
    case 'library':
      body = <Library />;
      break;
    case 'stats':
      body = <Stats />;
      break;
    case 'settings':
      body = <Settings toCredits={() => push({ name: 'credits' })} />;
      break;
    case 'eras':
      body = <Eras start={start} back={back} />;
      break;
    case 'composers':
      body = <Composers start={start} back={back} />;
      break;
    case 'weak':
      body = <Weak start={start} back={back} toLibrary={() => tab('library')} toComposers={() => replace({ name: 'composers' })} />;
      break;
    case 'credits':
      body = <Credits back={back} />;
      break;
    case 'quiz':
      body = <Quiz key={route.run} mode={route.mode} onExit={back} onDone={(summary) => replace({ name: 'result', mode: route.mode, summary })} />;
      break;
    case 'result':
      body = (
        <Result
          summary={route.summary}
          again={() => {
            player.unlock();
            replace({ name: 'quiz', mode: route.mode, run: Date.now() });
          }}
          home={back}
        />
      );
      break;
  }

  return (
    <div className="app">
      <main key={route.name === 'quiz' ? `quiz-${route.run}` : route.name} style={{ display: 'contents' }}>
        {body}
      </main>
      {isTab(route.name) && (
        <nav className="tabbar" aria-label="Разделы">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${route.name === t.id ? 'on' : ''}`} aria-current={route.name === t.id ? 'page' : undefined} onClick={() => tab(t.id)}>
              <t.icon />
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
