const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

function makeSvg(size, withBg = true, padding = 0.2) {
  const p = size * padding;
  const inner = size - p * 2;
  const bg = withBg ? `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#ffffff"/>` : '';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <g transform="translate(${p}, ${p})">
    <svg viewBox="0 0 120 120" width="${inner}" height="${inner}">
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
  const sizes = { 'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192 };

  for (const [dir, size] of Object.entries(sizes)) {
    const outDir = path.join(resDir, dir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // ic_launcher.png — with white rounded background
    await sharp(makeSvg(512, true, 0.2)).resize(size, size).png().toFile(path.join(outDir, 'ic_launcher.png'));
    console.log(`  ${dir}/ic_launcher.png (${size}x${size})`);

    // ic_launcher_round.png — same but will be masked by Android
    await sharp(makeSvg(512, true, 0.2)).resize(size, size).png().toFile(path.join(outDir, 'ic_launcher_round.png'));
    console.log(`  ${dir}/ic_launcher_round.png (${size}x${size})`);

    // ic_launcher_foreground.png — no background, more padding for adaptive icon
    await sharp(makeSvg(512, false, 0.28)).resize(size, size).png().toFile(path.join(outDir, 'ic_launcher_foreground.png'));
    console.log(`  ${dir}/ic_launcher_foreground.png (${size}x${size})`);
  }

  // Also save to public/ for web favicon
  await sharp(makeSvg(512, true, 0.15)).resize(192, 192).png().toFile(path.join(__dirname, '..', 'public', 'icon-192.png'));
  await sharp(makeSvg(512, true, 0.15)).resize(512, 512).png().toFile(path.join(__dirname, '..', 'public', 'icon-512.png'));
  console.log('  public/icon-192.png, icon-512.png');

  console.log('\nDone!');
}

generate().catch(console.error);
