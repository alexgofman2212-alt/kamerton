// Проверка PWA по тому же подпути, на котором приложение будет в GitHub Pages.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const port = 4182;
const origin = `http://127.0.0.1:${port}`;
const path = '/kamerton/';
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(origin + path)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto(origin + path);
  await page.getByRole('heading', { name: 'Слушатель' }).waitFor();
  const registration = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  const manifest = await (await context.request.get(origin + path + 'manifest.webmanifest')).json();
  const icon = await context.request.get(origin + path + 'icon-192.png');
  if (registration !== origin + path || manifest.start_url !== path || manifest.scope !== path || !icon.ok()) {
    throw new Error(JSON.stringify({ registration, start_url: manifest.start_url, scope: manifest.scope, icon: icon.status() }));
  }
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Слушатель' }).waitFor();
  console.log(JSON.stringify({ registration, offline: 'ok', icon: icon.status() }));
} finally {
  await browser?.close();
  server.kill();
}
