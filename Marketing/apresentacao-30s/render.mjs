// Renderiza os quadros do spot (determinístico, um quadro por instante t).
// Uso: node render.mjs <pasta-saida> <inicio> <fim> [fps=30]
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [out, a, b, fps=30] = [process.argv[2], +process.argv[3], +process.argv[4], +(process.argv[5]||30)];
const br = await chromium.launch();
const p = await br.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(pathToFileURL(path.resolve('spot.html')).href);
await p.waitForFunction('window.__ready');
for (let i = a; i < b; i++) {
  await p.evaluate(t => renderAt(t), i / fps);
  await p.screenshot({ path: `${out}/f_${String(i).padStart(4,'0')}.jpg`, type: 'jpeg', quality: 93 });
}
await br.close();
