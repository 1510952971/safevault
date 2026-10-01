import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = String(packageInfo.version);
const parts = version.split('.').map((value) => Number.parseInt(value, 10) || 0);
const versionCode = (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);

function replace(file, replacements) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [pattern, value] of replacements) content = content.replace(pattern, value);
  fs.writeFileSync(filePath, content, 'utf8');
}

replace('android/app/build.gradle', [
  [/versionCode\s+\d+/, `versionCode ${versionCode}`],
  [/versionName\s+"[^"]+"/, `versionName "${version}"`]
]);

replace('ios/App/App.xcodeproj/project.pbxproj', [
  [/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${versionCode};`],
  [/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`]
]);

console.log(`SafeVault platform versions synchronized: ${version} (${versionCode})`);
