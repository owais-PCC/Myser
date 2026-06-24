const sharp = require('sharp');
const path = require('path');

function makeSplashSvg(w, h) {
  const s = Math.min(w, h) * 0.25;
  const cx = w / 2 - s / 2;
  const cy = h / 2 - s / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#ffffff"/>
  <g transform="translate(${cx}, ${cy})">
    <svg viewBox="0 0 120 120" width="${s}" height="${s}">
      <defs>
        <linearGradient id="g" x1="0" y1="0.1" x2="0.9" y2="1">
          <stop offset="0" stop-color="#0e9560"/>
          <stop offset="1" stop-color="#1ac389"/>
        </linearGradient>
      </defs>
      <path d="M18 100 L18 26 L60 66" fill="none" stroke="url(#g)" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M60 66 L102 26 L102 100" fill="none" stroke="#52666f" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </g>
</svg>`);
}

async function generate() {
  const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

  const portrait = [
    ['drawable-port-mdpi', 320, 480],
    ['drawable-port-hdpi', 480, 800],
    ['drawable-port-xhdpi', 720, 1280],
    ['drawable-port-xxhdpi', 960, 1600],
    ['drawable-port-xxxhdpi', 1280, 1920],
  ];

  const landscape = [
    ['drawable-land-mdpi', 480, 320],
    ['drawable-land-hdpi', 800, 480],
    ['drawable-land-xhdpi', 1280, 720],
    ['drawable-land-xxhdpi', 1600, 960],
    ['drawable-land-xxxhdpi', 1920, 1280],
  ];

  for (const [dir, w, h] of [...portrait, ...landscape]) {
    await sharp(makeSplashSvg(w, h)).resize(w, h).png().toFile(path.join(resDir, dir, 'splash.png'));
    console.log(`  ${dir}/splash.png (${w}x${h})`);
  }

  // Default drawable splash
  await sharp(makeSplashSvg(480, 800)).resize(480, 800).png().toFile(path.join(resDir, 'drawable', 'splash.png'));
  console.log('  drawable/splash.png');

  console.log('\nDone!');
}

generate().catch(console.error);
