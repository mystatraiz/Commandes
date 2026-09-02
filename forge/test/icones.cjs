/* Génère les PNG de l'icône à partir de public/icon.svg, via Chromium.
   npm run icons */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const svg = fs.readFileSync(path.join(PUB, 'icon.svg'), 'utf8');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const rendre = async (taille, fichier, { maskable = false } = {}) => {
    const pg = await b.newPage({ viewport: { width: taille, height: taille }, deviceScaleFactor: 1 });
    // Maskable : le pictogramme occupe la zone sûre (80 % au centre), le fond remplit tout.
    const marge = maskable ? Math.round(taille * 0.1) : 0;
    const svgFond = maskable ? svg.replace(/rx="104"/, 'rx="0"') : svg;
    await pg.setContent(`<html><body style="margin:0;background:${maskable ? '#0B0D12' : 'transparent'}">
      <div style="position:absolute;inset:0;background:${maskable ? '#0B0D12' : 'transparent'}"></div>
      <img src="data:image/svg+xml;base64,${Buffer.from(maskable ? svg : svgFond).toString('base64')}" style="position:absolute;left:${marge}px;top:${marge}px;width:${taille - 2 * marge}px;height:${taille - 2 * marge}px" />
    </body></html>`);
    await pg.screenshot({ path: path.join(PUB, fichier), omitBackground: !maskable });
    await pg.close();
    console.log('  ' + fichier);
  };
  await rendre(192, 'icon-192.png');
  await rendre(512, 'icon-512.png');
  await rendre(512, 'icon-maskable-512.png', { maskable: true });
  await rendre(180, 'apple-touch-icon.png');
  await b.close();
})();
