// Проверка воспроизведения настоящей записи с Wikimedia в браузере.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const port = 4181;
const base = `http://127.0.0.1:${port}`;
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ locale: 'ru-RU' });
  const audioResponses = [];
  page.on('response', (response) => {
    if (response.url().includes('upload.wikimedia.org')) audioResponses.push(response.status());
  });
  await page.goto(base);
  await page.getByRole('button', { name: /Начать/ }).click();
  await Promise.race([
    page.getByText('Что звучит?').waitFor({ timeout: 25000 }),
    page.getByText('Не удалось загрузить запись').waitFor({ timeout: 25000 }),
  ]);
  const playing = await page.getByText('Что звучит?').isVisible();
  console.log(JSON.stringify({ playing, audioResponses }));
  if (!playing) process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
