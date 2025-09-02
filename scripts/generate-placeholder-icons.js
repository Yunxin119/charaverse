const fs = require('fs');
const path = require('path');

// 创建一个简单的PNG placeholder (1x1像素透明PNG的base64)
const transparentPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const placeholderPng = Buffer.from(transparentPngBase64, 'base64');

// 需要创建的图标尺寸
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// 确保icons目录存在
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 创建placeholder图标文件
iconSizes.forEach(size => {
  const filename = `icon-${size}x${size}.png`;
  const filepath = path.join(iconsDir, filename);
  
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, placeholderPng);
    console.log(`Created placeholder: ${filename}`);
  } else {
    console.log(`File already exists: ${filename}`);
  }
});

// 创建favicon.ico (简单的PNG重命名)
const faviconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
if (!fs.existsSync(faviconPath)) {
  fs.writeFileSync(faviconPath, placeholderPng);
  console.log('Created placeholder: favicon.ico');
} else {
  console.log('File already exists: favicon.ico');
}

// 创建apple-touch-icon.png
const appleIconPath = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');
if (!fs.existsSync(appleIconPath)) {
  fs.writeFileSync(appleIconPath, placeholderPng);
  console.log('Created placeholder: apple-touch-icon.png');
} else {
  console.log('File already exists: apple-touch-icon.png');
}

console.log('\n✅ Placeholder icons generated!');
console.log('📝 Note: These are 1x1 transparent placeholder images.');
console.log('🎨 To create proper icons:');
console.log('   1. Open generate-icons.html in your browser');
console.log('   2. Use the generated icons to replace these placeholders');
console.log('   3. Or use any online PNG/ICO generator with the SVG icon');