#!/usr/bin/env node
/**
 * Собирает src/data/catalog.json из tools/catalog-src.json.
 *
 *   node tools/build-catalog.mjs              — метаданные и лицензии с Wikimedia Commons
 *   node tools/build-catalog.mjs --analyze    — плюс анализ звука: начало музыки и «неочевидные» места
 *   node tools/build-catalog.mjs --selfhost   — плюс копии записей в public/audio (свой хостинг)
 *
 * --analyze и --selfhost скачивают записи и требуют ffmpeg в PATH.
 * Скачанное кешируется в tools/cache, повторный запуск продолжает с того же места.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'tools/catalog-src.json');
const OUT = join(ROOT, 'src/data/catalog.json');
const CACHE = join(ROOT, 'tools/cache');
const AUDIO = join(ROOT, 'public/audio');
const META = join(CACHE, 'meta.json');
const ANALYSIS = join(CACHE, 'analysis.json');

const args = new Set(process.argv.slice(2));
const SELFHOST = args.has('--selfhost');
const ANALYZE = args.has('--analyze') || SELFHOST;
const REFRESH = args.has('--refresh');

// Wikimedia просит называть клиента; при публичном запуске добавьте сюда контакт проекта.
const UA = process.env.KAMERTON_UA || 'KamertonCatalogBuilder/0.1 (classical music ear-training app; catalog build script)';
const API = 'https://commons.wikimedia.org/w/api.php';

/** Лицензии, с которыми запись можно использовать в публичном приложении. */
const ALLOWED = [/^public domain$/i, /^pd\b/i, /^cc0/i, /^cc[ -]by(-sa)?[ -]\d/i, /^cc[ -]pd/i, /^no restrictions$/i];
const licenseOk = (l) => ALLOWED.some((re) => re.test(l.trim()));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const strip = (s) =>
  (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** fetch, который честно ждёт Retry-After при 429. */
async function polite(url, init = {}, tries = 12) {
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) } });
    } catch (e) {
      await sleep(5000);
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const wait = Math.min(Number(res.headers.get('retry-after')) || 20, 900) + 1;
      process.stdout.write(`  …сервер просит подождать ${wait} с\n`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
    return res;
  }
  throw new Error(`Не удалось получить ${url}: сервер всё время отвечает «слишком много запросов»`);
}

async function fetchMeta(files) {
  const meta = REFRESH ? {} : readJson(META, {});
  const missing = files.filter((f) => !meta[f]);
  for (let i = 0; i < missing.length; i += 40) {
    const batch = missing.slice(i, i + 40);
    const q = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'videoinfo',
      viprop: 'url|size|mime|extmetadata|derivatives',
      titles: batch.map((f) => `File:${f}`).join('|'),
    });
    console.log(`Метаданные: ${i + 1}–${i + batch.length} из ${missing.length}`);
    const data = await (await polite(`${API}?${q}`)).json();
    const norm = new Map((data.query.normalized || []).map((n) => [n.to, n.from]));
    for (const page of data.query.pages || []) {
      const asked = (norm.get(page.title) || page.title).replace(/^File:/, '');
      const vi = page.videoinfo?.[0];
      if (page.missing || !vi) {
        meta[asked] = { missing: true };
        continue;
      }
      const em = vi.extmetadata || {};
      const mp3 = vi.mime === 'audio/mpeg' ? vi.url : (vi.derivatives || []).find((d) => d.transcodekey === 'mp3' || /audio\/mpeg/.test(d.type || ''))?.src;
      meta[asked] = {
        duration: vi.duration,
        original: vi.url.split('?')[0],
        mp3: mp3 ? mp3.split('?')[0] : null,
        mime: vi.mime,
        page: vi.descriptionurl,
        license: strip(em.LicenseShortName?.value) || 'unknown',
        artist: strip(em.Artist?.value),
        credit: strip(em.Credit?.value),
      };
    }
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(META, JSON.stringify(meta, null, 1));
  }
  return meta;
}

function run(cmd, argv, { collect = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', collect ? 'pipe' : 'ignore', 'ignore'] });
    const chunks = [];
    if (collect) p.stdout.on('data', (c) => chunks.push(c));
    p.on('error', (e) => reject(new Error(`${cmd} не запускается (${e.code}). Нужен ffmpeg в PATH.`)));
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`${cmd} завершился с кодом ${code}`))));
  });
}

/** Громкость по окнам 0,5 с → начало музыки и места для «неочевидных» фрагментов. */
async function analyze(file) {
  const RATE = 8000;
  const WIN = RATE / 2;
  const pcm = await run('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-'], { collect: true });
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const rms = [];
  for (let i = 0; i + WIN <= samples.length; i += WIN) {
    let s = 0;
    for (let j = i; j < i + WIN; j++) s += samples[j] * samples[j];
    rms.push(Math.sqrt(s / WIN));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  const loud = p(0.9);
  const median = p(0.5);
  const gate = Math.max(loud * 0.06, 60);
  const first = rms.findIndex((v) => v > gate);
  const intro = Math.max(0, first * 0.5 - 0.2);

  // Тело записи делим на 6 участков; в каждом берём 12-секундное окно без провалов в тишину.
  const duration = rms.length * 0.5;
  const from = Math.max(intro + 25, duration * 0.22);
  const to = duration - 22;
  const spots = [];
  const N = 6;
  const span = 24; // окон по 0,5 с = 12 с
  for (let k = 0; k < N && to > from; k++) {
    const a = Math.floor(((from + ((to - from) * k) / N)) * 2);
    const b = Math.floor(((from + ((to - from) * (k + 1)) / N)) * 2);
    let best = -1;
    let bestScore = -1;
    for (let i = a; i < b && i + span < rms.length; i += 2) {
      let min = Infinity;
      for (let j = i; j < i + span; j++) min = Math.min(min, rms[j]);
      if (min > bestScore) {
        bestScore = min;
        best = i;
      }
    }
    if (best >= 0 && bestScore > median * 0.2) spots.push(Math.round(best * 0.5));
  }
  return { intro: Math.round(intro * 10) / 10, spots, duration: Math.round(duration * 10) / 10 };
}

async function download(url, file) {
  if (existsSync(file)) return;
  const res = await polite(url);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  await sleep(1500); // не торопим сервер между записями
}

/** Без анализа: начало с нуля, места — равномерно по середине записи. */
function guess(duration) {
  const spots = [0.3, 0.42, 0.54, 0.66, 0.78].map((f) => Math.round(duration * f)).filter((t) => t > 25 && t < duration - 20);
  return { intro: 0, spots };
}

async function main() {
  const src = JSON.parse(readFileSync(SRC, 'utf8'));
  const composerIds = new Set(src.composers.map((c) => c.id));
  const meta = await fetchMeta(src.pieces.map((p) => p.file));
  const analysis = readJson(ANALYSIS, {});
  const problems = [];
  const awaitingAttribution = [];
  const pieces = [];

  for (const p of src.pieces) {
    const m = meta[p.file];
    if (!composerIds.has(p.composer)) problems.push(`${p.id}: неизвестный композитор ${p.composer}`);
    if (!m || m.missing) {
      problems.push(`${p.id}: файл не найден на Commons — ${p.file}`);
      continue;
    }
    if (!licenseOk(m.license)) {
      problems.push(`${p.id}: лицензия «${m.license}» не в списке разрешённых — ${m.page}`);
      continue;
    }
    if (!m.mp3) {
      problems.push(`${p.id}: у файла нет MP3-версии — ${m.page}`);
      continue;
    }
    // Пустая строка в исходном каталоге означает, что исполнитель проверен и пока неизвестен.
    // Отсутствующее поле допускает атрибуцию исполнителя из метаданных Commons.
    if (/^cc[ -]by/i.test(m.license) && p.artist === '') {
      awaitingAttribution.push(p.id);
      continue;
    }

    let marks = analysis[p.id]?.file === p.file ? analysis[p.id] : null;
    let srcUrl = m.mp3;
    if (ANALYZE) {
      mkdirSync(CACHE, { recursive: true });
      const local = join(CACHE, `${p.id}.mp3`);
      try {
        if (!marks || SELFHOST) {
          console.log(`Запись: ${p.id}`);
          await download(m.mp3, local);
        }
        if (!marks) {
          marks = { file: p.file, ...(await analyze(local)) };
          analysis[p.id] = marks;
          writeFileSync(ANALYSIS, JSON.stringify(analysis, null, 1));
        }
        if (SELFHOST) {
          mkdirSync(AUDIO, { recursive: true });
          const out = join(AUDIO, `${p.id}.mp3`);
          if (!existsSync(out)) await run('ffmpeg', ['-v', 'error', '-y', '-i', local, '-vn', '-ac', '2', '-b:a', '96k', out]);
          srcUrl = `/audio/${p.id}.mp3`;
        }
      } catch (e) {
        problems.push(`${p.id}: ${e.message}`);
      }
    }
    const duration = marks?.duration || m.duration;
    const base = marks || guess(duration);
    // hook — секунда, с которой звучит знаменитая тема, если она не в начале записи.
    const intro = p.hook ?? base.intro;
    const spots = base.spots.filter((t) => Math.abs(t - intro) > 20);

    pieces.push({
      id: p.id,
      composer: p.composer,
      title: p.title,
      ...(p.part ? { part: p.part } : {}),
      ...(p.year ? { year: p.year } : {}),
      era: p.era || src.composers.find((c) => c.id === p.composer).era,
      kind: p.kind,
      tier: p.tier,
      rec: { src: srcUrl, duration: Math.round(duration * 10) / 10, license: m.license, artist: p.artist ?? (m.artist || m.credit), page: m.page },
      intro,
      spots,
    });
  }

  const used = new Set(pieces.map((p) => p.composer));
  writeFileSync(OUT, JSON.stringify({ composers: src.composers.filter((c) => used.has(c.id)), pieces }, null, 1) + '\n');
  console.log(`\nГотово: ${pieces.length} произведений, ${used.size} композиторов → src/data/catalog.json`);
  const analyzed = pieces.filter((p) => analysis[p.id]).length;
  console.log(`Проанализировано звука: ${analyzed} из ${pieces.length}${analyzed < pieces.length ? ' (остальным места фрагментов заданы приблизительно; запустите с --analyze)' : ''}`);
  if (awaitingAttribution.length) {
    console.log(`Не опубликованы без атрибуции исполнителя (${awaitingAttribution.length}): ${awaitingAttribution.join(', ')}`);
  }
  if (problems.length) {
    console.log(`\nПроблемы (${problems.length}):`);
    for (const x of problems) console.log(`  - ${x}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
