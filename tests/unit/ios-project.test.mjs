/* The iPhone project can't be built on this machine, so this checks what can be
   checked without Xcode: that the project file, the Swift sources, the
   permissions and the web bridge all agree with each other. If any of these
   fail, the Xcode build would too. */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { ok, done, ROOT } from '../lib.mjs';

const IOS = join(ROOT, 'ios');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const pbx = read('ios/AlexHQ.xcodeproj/project.pbxproj');

const swiftFiles = [];
(function walk(dir){
  for (const f of readdirSync(dir)){
    const full = join(dir, f);
    if (statSync(full).isDirectory()){ if (f !== 'AlexHQ.xcodeproj' && f !== 'tools') walk(full); }
    else if (f.endsWith('.swift')) swiftFiles.push(full);
  }
})(IOS);

// ---- every Swift file is compiled by some target, and nothing compiled is missing
const compiled = [...pbx.matchAll(/(\S+\.swift) in Sources/g)].map(m => m[1]);
const notCompiled = swiftFiles.map(f => basename(f)).filter(f => !compiled.includes(f));
ok(notCompiled.length === 0, 'every Swift file is in the Xcode project' + (notCompiled.length ? ' (missing: ' + notCompiled.join(', ') + ')' : ''));
const gone = compiled.filter(f => !swiftFiles.some(s => basename(s) === f));
ok(gone.length === 0, 'every compiled file exists' + (gone.length ? ' (not found: ' + gone.join(', ') + ')' : ''));

// ---- the web app is shipped as is, not copied
ok(/path = \.\.\/assets;/.test(pbx) && /path = \.\.\/index\.html;/.test(pbx), 'the project points at ../assets and ../index.html');
ok(existsSync(join(ROOT, 'index.html')) && existsSync(join(ROOT, 'assets/js/main.js')), 'and they exist');
ok(!/iPhoneOS\d/.test(pbx), 'framework links are not tied to one SDK version');

// ---- identity: bundle ids and the App Group agree everywhere (and follow each other if renamed)
const ids = [...new Set([...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([\w.]+);/g)].map(m => m[1]))];
const appId = ids.find(i => !i.endsWith('.widgets'));
ok(ids.length === 2 && ids.includes(appId + '.widgets'), 'app and widget bundle ids: ' + ids.join(', '));
const group = /static let group = "([^"]+)"/.exec(read('ios/Shared/SharedStore.swift'))?.[1];
ok(group === 'group.' + appId, 'the App Group follows the app id: ' + group);
const entGroups = ['ios/AlexHQ/AlexHQ.entitlements', 'ios/AlexHQWidgets/AlexHQWidgets.entitlements'].map(f => read(f).includes(`<string>${group}</string>`));
ok(entGroups.every(Boolean), 'both entitlements files list that App Group');

// ---- permissions the features need are declared (a missing one crashes the app on first use)
const plist = read('ios/AlexHQ/Info.plist');
for (const key of ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSFaceIDUsageDescription', 'NSHealthShareUsageDescription', 'NSHealthUpdateUsageDescription', 'NSSupportsLiveActivities'])
  ok(plist.includes(`<key>${key}</key>`), `Info.plist declares ${key}`);
ok(read('ios/AlexHQ/AlexHQ.entitlements').includes('com.apple.developer.healthkit'), 'HealthKit entitlement present');
ok(read('ios/AlexHQWidgets/Info.plist').includes('com.apple.widgetkit-extension'), 'the widget extension declares its type');

// ---- the page and the phone speak the same commands
const web = read('assets/js/core/native.js');
const sent = new Set([...web.matchAll(/(?:send|fire)\('([\w.]+)'/g)].map(m => m[1]));
const handled = new Set([...read('ios/AlexHQ/NativeBridge.swift').matchAll(/case "([\w.]+)"/g)].map(m => m[1]));
const unhandled = [...sent].filter(c => !handled.has(c));
ok(sent.size >= 15, `the page sends ${sent.size} kinds of message`);
ok(unhandled.length === 0, 'the phone handles every message the page sends' + (unhandled.length ? ' (not handled: ' + unhandled.join(', ') + ')' : ''));
const swiftMarker = read('ios/AlexHQ/WebHost.swift');
ok(/window\.__NATIVE__/.test(swiftMarker) && /__NATIVE__/.test(web), 'the "I am the app" marker is set by Swift and read by the page');
ok(/BundleSchemeHandler\.scheme/.test(swiftMarker) && /static let scheme = "alexhq"/.test(read('ios/AlexHQ/BundleSchemeHandler.swift')), 'the web view serves the bundle under the alexhq scheme');

// ---- the bundled copy of the web app must be complete: every module the page imports is inside ../assets
const missing = [];
(function check(dir){
  for (const f of readdirSync(join(ROOT, dir))){
    const rel = `${dir}/${f}`;
    if (statSync(join(ROOT, rel)).isDirectory()) check(rel);
    else if (f.endsWith('.js')){
      for (const m of readFileSync(join(ROOT, rel), 'utf8').matchAll(/from '(\.[^']+\.js)'/g)){
        const target = join(ROOT, dir, m[1]);
        if (!existsSync(target)) missing.push(`${rel} -> ${m[1]}`);
      }
    }
  }
})('assets/js');
ok(missing.length === 0, 'every import resolves inside assets/' + (missing.length ? ' (' + missing.join('; ') + ')' : ''));

done('iOS project consistency');
