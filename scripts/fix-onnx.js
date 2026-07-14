const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'onnxruntime-react-native', 'android', 'build.gradle');

// Si le package n'est pas là (ex: build iOS seulement), on ignore
if (!fs.existsSync(filePath)) {
  console.log('onnxruntime-react-native non trouvé, ignore.');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

// Le code d'origine qu'on veut remplacer
const oldCode = `  if (VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")) {
    extractLibs "com.facebook.fbjni:fbjni:+:headers"
    extractLibs "com.facebook.fbjni:fbjni:+"
  }`;

// Le nouveau code
const newCode = `  def reactNativeVersionParts = REACT_NATIVE_VERSION.split("\\\\.")
  def reactNativeMajor = reactNativeVersionParts[0].toInteger()
  def reactNativeMinor = reactNativeVersionParts[1].toInteger()
  if (reactNativeMajor == 0 && reactNativeMinor < 71) {
    extractLibs "com.facebook.fbjni:fbjni:+:headers"
    extractLibs "com.facebook.fbjni:fbjni:+"
  }`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ onnxruntime-react-native corrigé avec succès !');
} else {
  console.log('⚠️ Le code à remplacer n\'a pas été trouvé (déjà corrigé ou version différente).');
}
