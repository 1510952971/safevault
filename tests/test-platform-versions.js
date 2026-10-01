import fs from 'node:fs';
import assert from 'node:assert';

const packageInfo = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const androidGradle = fs.readFileSync('android/app/build.gradle', 'utf8');
const iosProject = fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');

assert.match(androidGradle, new RegExp(`versionName "${packageInfo.version.replaceAll('.', '\\.')}"`));
assert.match(iosProject, new RegExp(`MARKETING_VERSION = ${packageInfo.version.replaceAll('.', '\\.')}[;]`));

console.log(`✓ Web、桌面端、NAS、Android 与 iOS 版本均为 ${packageInfo.version}`);
