import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svg = fs.readFileSync('public/favicon.svg');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const s of sizes) {
  await sharp(svg).resize(s, s).png().toFile(`public/icons/icon-${s}x${s}.png`);
  console.log(`✓ icon-${s}x${s}.png`);
}
await sharp(svg).resize(512, 512).png().toFile('public/icons/icon-512x512-maskable.png');
console.log('✓ icon-512x512-maskable.png');
await sharp(svg).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
console.log('✓ apple-touch-icon.png');
await sharp(svg).resize(16, 16).png().toFile('public/icons/favicon-16x16.png');
await sharp(svg).resize(32, 32).png().toFile('public/icons/favicon-32x32.png');
console.log('✓ favicon-16x16.png + favicon-32x32.png');
await sharp(svg).resize(270, 270).png().toFile('public/icons/msapplication-icon-270x270.png');
console.log('✓ msapplication-icon-270x270.png');
console.log('\nAll icons generated!');
