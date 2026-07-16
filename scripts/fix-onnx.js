const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'onnxruntime-react-native', 'android', 'build.gradle');

// Si le package n'est pas là (ex: build iOS seulement), on ignore
if (!fs.existsSync(filePath)) {
  console.log('onnxruntime-react-native non trouvé, ignore.');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

// Assure l'import de VersionNumber pour les versions récentes de Gradle
if (!content.includes('import org.gradle.util.VersionNumber')) {
  // Insère l'import juste avant le premier bloc 'buildscript' s'il existe, sinon au début
  if (content.match(/\n\s*buildscript\s*\{/)) {
    content = content.replace(/(\n)\s*buildscript\s*\{/, "$1import org.gradle.util.VersionNumber\nbuildscript {");
  } else {
    content = 'import org.gradle.util.VersionNumber\n' + content;
  }
}

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
