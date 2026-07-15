const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, '..', 'icons', 'LOGOig.png');
const svgPath = path.join(__dirname, '..', 'icons', 'icon.svg');
const svgMaskPath = path.join(__dirname, '..', 'icons', 'icon-maskable.svg');

try {
  const pngBuffer = fs.readFileSync(pngPath);
  const base64 = pngBuffer.toString('base64');
  
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="100%" height="100%">
  <image href="data:image/png;base64,${base64}" x="0" y="0" width="1000" height="1000"/>
</svg>`;

  fs.writeFileSync(svgPath, svgContent);
  fs.writeFileSync(svgMaskPath, svgContent);
  console.log('Successfully embedded PNG inside SVG files!');
} catch (err) {
  console.error('Error embedding logo:', err);
  process.exit(1);
}
