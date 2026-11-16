// Рендерит PNG-иконки из public/icon.svg (нужен Playwright с Chromium).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright берётся из проекта, а если его там нет — из глобальной установки (NODE_PATH).
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  ({ chromium } = createRequire(`${process.env.NODE_PATH}/`)('playwright'));
}

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const shot = async (file, size, pad, square) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = square ? svg.replace('rx="112"', 'rx="0"') : svg;
  await page.setContent(
    `<body style="margin:0;background:${square ? '#0f0e13' : 'transparent'};display:grid;place-items:center;height:100vh"><div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${inner}</div></body>`,
  );
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: !square });
  await page.close();
};
await shot('icon-192.png', 192, 0, false);
await shot('icon-512.png', 512, 0, false);
await shot('icon-maskable-512.png', 512, 52, true);
await shot('apple-touch-icon.png', 180, 0, true);
await browser.close();
