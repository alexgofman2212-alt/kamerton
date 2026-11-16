// Сквозная проверка в браузере. Записи с Wikimedia подменяются тоном, сгенерированным в памяти,
// поэтому тест не зависит от сети:  npm run build && node tools/e2e.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  ({ chromium } = createRequire(`${process.env.NODE_PATH}/`)('playwright'));
}

const PORT = 4179;
const BASE = `http://localhost:${PORT}`;
const SHOTS = fileURLToPath(new URL('./out/shots/', import.meta.url));
const catalog = JSON.parse(readFileSync(new URL('../src/data/catalog.json', import.meta.url), 'utf8'));
const stub = tone(620);
const bySrc = new Map(catalog.pieces.map((p) => [p.rec.src, p]));
mkdirSync(SHOTS, { recursive: true });

/** WAV с тихим синусом: 8 кГц, 8 бит, моно. */
function tone(seconds) {
  const rate = 8000;
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) buf[44 + i] = 128 + Math.round(40 * Math.sin((2 * Math.PI * 330 * i) / rate));
  return buf;
}

const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [viteCli, 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const fail = [];
const check = (ok, what) => {
  console.log(`${ok ? '✓' : '✗'} ${what}`);
  if (!ok) fail.push(what);
};

try {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'ru-RU' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  let current = null; // какое произведение сейчас запросил плеер
  await page.route(/upload\.wikimedia\.org|\/audio\//, (route) => {
    const url = route.request().url();
    current = bySrc.get(url) || bySrc.get(new URL(url).pathname) || current;
    route.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'accept-ranges': 'bytes' }, body: stub });
  });
  const shot = async (name) => {
    await page.waitForTimeout(500); // дождаться конца анимаций
    await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  };

  await page.goto(BASE);
  await page.getByText('Ваш ранг').waitFor();
  check(await page.getByRole('heading', { name: 'Слушатель' }).isVisible(), 'главная: стартовый ранг «Слушатель»');
  await shot('01-home');

  // --- занятие: 10 вопросов, один намеренно неверный ---
  await page.getByRole('button', { name: /Начать/ }).click();
  let asked = 0;
  let clip = null;
  for (;;) {
    await page.locator('.opt').first().waitFor();
    await page.getByText('Что звучит?').waitFor({ timeout: 10000 });
    asked++;
    const options = await page.locator('.opt').count();
    if (asked === 1) {
      check(options === 5, 'в вопросе 5 вариантов ответа');
      clip = await page.locator('.stage .chip').nth(1).innerText();
      check(clip === '15 с', `новичку звучит фрагмент 15 с (показано: ${clip})`);
      await shot('02-question');
    }
    const title = current.title;
    const right = page.locator('.opt', { has: page.locator('.t', { hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
    if (asked === 3) {
      const wrong = page.locator('.opt').filter({ hasNot: page.locator('.t', { hasText: title }) }).first();
      await wrong.click();
      check(await page.locator('.opt.wrong').count() === 1 && await page.locator('.opt.right').count() === 1, 'ошибка: подсвечены выбранный и верный варианты');
      await shot('03-wrong');
    } else {
      await right.first().click();
      if (asked === 1) {
        check(await page.getByText(/Верно · \+\d+ опыта/).isVisible(), 'верный ответ: показан начисленный опыт');
        await shot('04-right');
      }
    }
    const next = page.locator('.quiz-foot .btn');
    const label = await next.innerText();
    await next.click();
    if (label === 'Итоги') break;
  }
  check(asked === 11, `занятие: 10 вопросов + повтор ошибки = 11 (было ${asked})`);
  await page.getByText('Ещё занятие').waitFor();
  check(await page.locator('.score').innerText().then((t) => t.replace(/\s+/g, ' ').includes('10 из 11')), 'итог: 10 из 11');
  check(await page.getByText('Стоит переслушать').isVisible(), 'итог: список ошибок');
  await shot('05-result');
  await page.getByRole('button', { name: 'На главную' }).click();

  // --- прогресс сохранился, появилось слабое место и новый ранг ---
  await page.getByText('Ваш ранг').waitFor();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kamerton.progress.v1')));
  check(saved.xp > 100 && Object.keys(saved.pieces).length === 10, `прогресс сохранён: ${saved.xp} опыта, ${Object.keys(saved.pieces).length} произведений`);
  check(await page.locator('.mode.wide .badge').innerText() === '1', 'главная: одно слабое место');
  await shot('06-home-after');

  await page.locator('.mode.wide').click();
  await page.getByRole('heading', { name: 'Слабые места' }).waitFor();
  check(await page.locator('.list .item').count() === 1, 'слабые места: в списке ошибочное произведение');
  await shot('07-weak');
  await page.getByRole('button', { name: /Тренировать/ }).click();
  await page.getByText('Что звучит?').waitFor({ timeout: 10000 });
  check(await page.locator('.stage .chip').first().innerText() === 'Слабое место', 'режим слабых мест спрашивает ошибочное произведение');
  await page.getByRole('button', { name: 'Завершить занятие' }).click();
  await page.getByRole('heading', { name: 'Слабые места' }).waitFor();
  await page.getByRole('button', { name: 'Назад' }).click();

  // --- режимы ---
  await page.locator('.mode', { hasText: 'Эпохи' }).click();
  await page.getByRole('heading', { name: 'По эпохам' }).waitFor();
  await shot('08-eras');
  await page.locator('.era-card').first().click();
  await page.getByText('Что звучит?').waitFor({ timeout: 10000 });
  check(current.era === 'baroque', `режим эпохи: звучит барокко (${current.title})`);
  await page.goBack();
  await page.goBack();

  await page.locator('.mode', { hasText: 'Композиторы' }).click();
  await page.getByRole('heading', { name: 'По композиторам' }).waitFor();
  await page.getByRole('checkbox').filter({ hasText: 'Шопен' }).click();
  await shot('09-composers');
  await page.getByRole('button', { name: /Тренировать/ }).click();
  await page.getByText('Что звучит?').waitFor({ timeout: 10000 });
  check(current.composer === 'chopin', `режим композиторов: звучит Шопен (${current.title})`);
  await page.goBack();
  await page.goBack();

  // --- вкладки ---
  await page.getByRole('button', { name: 'Библиотека' }).click();
  await page.getByRole('heading', { name: 'Библиотека' }).waitFor();
  await shot('10-library');
  await page.getByRole('button', { name: 'Прогресс' }).click();
  await page.getByText('Лестница рангов').waitFor();
  await shot('11-stats');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByText('Цель на день').waitFor();
  await page.getByRole('radio', { name: '10 ответов' }).click();
  check((await page.evaluate(() => JSON.parse(localStorage.getItem('kamerton.progress.v1')).settings.dailyGoal)) === 10, 'настройки: цель на день сохраняется');
  await shot('12-settings');
  await page.getByText('Записи и лицензии').click();
  await page.getByRole('heading', { name: 'Записи и лицензии' }).waitFor();
  check((await page.locator('.list .item').count()) === catalog.pieces.length, 'лицензии: перечислены все записи');

  // --- рост сложности: на высоком ранге фрагменты короче ---
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('kamerton.progress.v1'));
    p.xp = 5000;
    for (const s of Object.values(p.pieces)) Object.assign(s, { box: 6, due: 0, wrong: 0, right: 9, seen: 9 });
    localStorage.setItem('kamerton.progress.v1', JSON.stringify(p));
  });
  await page.goto(BASE);
  check(await page.getByRole('heading', { name: 'Маэстро' }).isVisible(), 'высокий опыт: ранг «Маэстро»');
  await page.getByRole('button', { name: /Тренировка дня/ }).click();
  await page.locator('.stage .chip').nth(1).waitFor();
  const reasons = new Set();
  for (let i = 0; i < 10; i++) {
    await page.getByText(/Что звучит\?|Фрагмент прозвучал/).waitFor({ timeout: 10000 });
    reasons.add(`${await page.locator('.stage .chip').first().innerText()} ${await page.locator('.stage .chip').nth(1).innerText()}`);
    await page.locator('.opt').first().click();
    await page.locator('.quiz-foot .btn').click();
    if (!(await page.locator('.opt').count())) break;
  }
  check([...reasons].some((r) => r === 'Повторение 4 с') && [...reasons].some((r) => r.startsWith('Новое 12 с')), `маэстро: усвоенное — 4 с, новое — 12 с (${[...reasons].join('; ')})`);

  // --- планшет/десктоп и узкий экран ---
  await page.goto(BASE);
  await page.setViewportSize({ width: 1280, height: 800 });
  await shot('13-desktop');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: /Тренировка дня/ }).click();
  await page.getByText(/Что звучит\?/).waitFor({ timeout: 10000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, 'узкий экран 320 px: нет горизонтальной прокрутки');
  await shot('14-small');

  check(errors.length === 0, `ошибок в консоли нет${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await browser.close();
} finally {
  server.kill();
}
console.log(fail.length ? `\nНе прошло: ${fail.length}` : '\nВсё прошло');
process.exit(fail.length ? 1 : 0);
