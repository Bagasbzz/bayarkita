import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('public');
const extensions = new Set(['.html', '.js', '.css', '.json', '.sql', '.toml', '.txt', '.svg']);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (extensions.has(path.extname(entry.name))) update(file);
  }
}

function update(file) {
  const source = fs.readFileSync(file, 'utf8');
  const protectedValues = [];
  const protect = (value) => {
    const token = `__BAYARKITA_PROTECTED_${protectedValues.length}__`;
    protectedValues.push([token, value]);
    return token;
  };
  let result = source
    .replaceAll('https://www.instagram.com/fahmidev.id/', protect('https://www.instagram.com/fahmidev.id/'))
    .replaceAll('https://www.threads.com/@fahmidev.id', protect('https://www.threads.com/@fahmidev.id'))
    .replaceAll('fahmidev.store', 'bayarkita.site')
    .replaceAll('PT Fahmidev Indo Finance', 'PT Maju Teknologi Digital')
    .replaceAll('https://t.me/fahmidev', 'https://t.me/bayarkitaid')
    .replaceAll('@fahmidev', '@bayarkitaid')
    .replaceAll('logo-fahmidev.png', 'logo-bayarkita.svg')
    .replaceAll('logo-fahmidev.svg', 'logo-bayarkita.svg')
    .replaceAll('Fahmidev', 'BayarKita')
    .replaceAll('fahmidev', 'bayarkita');
  for (const [token, value] of protectedValues) result = result.replaceAll(token, value);
  if (file.endsWith('.css')) {
    const colors = {
      '#d90d19': '#f97316', '#b60814': '#c2410c', '#fff3f3': '#fff7ed',
      '#ff4b54': '#fb923c', '#ee1723': '#ea580c', '#f53b47': '#fb923c',
      '#ef2231': '#fb923c', '#ff1c29': '#fb923c', '#e80b18': '#ea580c',
      '#ca0612': '#c2410c', '#e30d1a': '#ea580c', '#c90410': '#c2410c',
      '#f61729': '#fb923c', '#b90c16': '#c2410c', '#e4111d': '#ea580c',
      '#ed1723': '#ea580c', '#f02b38': '#fb923c', '#f15c63': '#fb923c',
      '#ef626e': '#fb923c', '#f25560': '#fb923c', '#fff0f1': '#fff7ed',
      '#fff1f1': '#fff7ed', '#fff2f3': '#fff7ed', '#fff4f4': '#fff7ed',
      '#fff5f5': '#fff7ed', '#fff6f6': '#fff7ed', '#fff7f7': '#fff7ed',
      '#ffdce0': '#fed7aa', '#ffd4d8': '#fed7aa', '#f2dadd': '#fed7aa',
      '#ffe1e3': '#fed7aa', '#ffd0d4': '#fed7aa', '#ffc6c9': '#fdba74',
      '#ffd1d5': '#fdba74', '#fac6c9': '#fdba74', '#f3b': '#fdba74',
    };
    result = result.replace(/#[0-9a-f]{3,8}/gi, (hex) => {
      const base = hex.slice(0, 7).toLowerCase();
      const alpha = hex.length > 7 ? hex.slice(7) : '';
      return colors[base] ? colors[base] + alpha : hex;
    });
    result = result
      .replace(/rgb\(\s*239,\s*34,\s*49\s*\)/gi, 'rgb(249, 115, 22)')
      .replace(/rgb\(\s*217,\s*13,\s*25\s*\)/gi, 'rgb(234, 88, 12)')
      .replace(/rgb\(\s*182,\s*8,\s*20\s*\)/gi, 'rgb(194, 65, 12)')
      .replace(/rgba\(\s*217,\s*13,\s*25,/gi, 'rgba(249, 115, 22,')
      .replace(/rgba\(\s*95,\s*3,\s*11,/gi, 'rgba(124, 45, 18,')
      .replaceAll('#ff1e2b', '#fb923c')
      .replaceAll('#ff535d', '#fb923c')
      .replaceAll('#e11d48', '#ea580c');
  }
  if (source !== result) fs.writeFileSync(file, result);
}

walk(root);
for (const file of ['functions/_lib/ai.js', 'functions/_lib/core.js', 'functions/_lib/seat-products.js']) {
  if (fs.existsSync(file)) update(file);
}
