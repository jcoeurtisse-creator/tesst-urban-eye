const fs = require('fs');
const path = require('path');

const patchPath = path.join(__dirname, '..', 'patches', 'onnxruntime-react-native+1.24.3.patch');

try {
  if (fs.existsSync(patchPath)) {
    fs.unlinkSync(patchPath);
    console.log('✅ Removed broken patch file:', patchPath);
  } else {
    console.log('ℹ️ No broken patch file to remove.');
  }
  process.exit(0);
} catch (err) {
  console.error('❌ Failed to remove broken patch file:', err);
  process.exit(1);
}
