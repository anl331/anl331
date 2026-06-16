import { chromium } from 'playwright';
import fs from 'node:fs';

const USER = 'anl331';
const REPOS = ['goey-toast', 'gooey-search-tabs', 'vid-clipper', 'chromakey-video-react'];

const ghHeaders = {
  'User-Agent': 'anl331-readme-stats',
  Accept: 'application/vnd.github+json',
  ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
};

async function ghRepo(repo) {
  const r = await fetch(`https://api.github.com/repos/${USER}/${repo}`, { headers: ghHeaders });
  if (!r.ok) throw new Error(`github ${repo} ${r.status}`);
  return r.json();
}

async function npmDownloads(period) {
  const r = await fetch(`https://api.npmjs.org/downloads/point/${period}/goey-toast`);
  if (!r.ok) throw new Error(`npm ${period} ${r.status}`);
  return (await r.json()).downloads;
}

const fmt = (n) =>
  n >= 1000 ? (Math.round(n / 100) / 10).toString().replace(/\.0$/, '') + 'k' : String(n);

// ---- fetch live data ----
const info = {};
for (const r of REPOS) {
  const j = await ghRepo(r);
  info[r] = { stars: j.stargazers_count, forks: j.forks_count };
}
const week = await npmDownloads('last-week');
const month = await npmDownloads('last-month');
console.log('stars', info, 'week', week, 'month', month);

// ---- render ----
const base = 'file://' + process.cwd() + '/';

const featuredHtml = fs
  .readFileSync('templates/featured.html', 'utf8')
  .replaceAll('__STARS__', fmt(info['goey-toast'].stars))
  .replaceAll('__WEEK__', fmt(week))
  .replaceAll('__MONTH__', fmt(month));
fs.writeFileSync('.render-featured.html', featuredHtml);

const browser = await chromium.launch();
async function shot(file, url, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: file });
  await page.close();
  console.log('rendered', file);
}

await shot('assets/goey-toast.png', base + '.render-featured.html', 1200, 400);
for (const r of REPOS) {
  const url = `${base}templates/repocard.html?r=${r}&s=${fmt(info[r].stars)}&f=${info[r].forks || ''}`;
  await shot(`assets/card-${r}.png`, url, 600, 230);
}

await browser.close();
fs.rmSync('.render-featured.html', { force: true });
console.log('done');
