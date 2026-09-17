#!/usr/bin/env node
/**
 * Dependency pin check for the react-app template. The template has three package.json files (root, api,
 * client) and no lockfile, so a pin that nothing else verifies can drift or point at a version that was
 * never published. Two rules:
 *
 *   1. A package pinned in more than one workspace is pinned with the same range everywhere. Two ranges for
 *      one package hoist two copies (or fail to hoist at all), and the second range is usually a bump that
 *      forgot the other workspace.
 *   2. Every pin of a package we publish ourselves (the PUBLISHED_SCOPES below) matches a version that is on
 *      the registry right now. Our packages are pinned before they are published, so this is the check that
 *      says "publish first". Third-party packages are not checked: their pins come from `npm install` and
 *      always match something.
 *
 * Nothing is installed; rule 2 is one `npm view` per package, so the check is fast enough to run before
 * every tag and in CI.
 *
 *   node scripts/checkDependencyPins.mjs                # react-app
 *   node scripts/checkDependencyPins.mjs --offline      # rule 1 only (no registry access)
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const templatesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templateDir = path.join(templatesRoot, 'react-app');
const isWindows = process.platform === 'win32';
const offline = process.argv.includes('--offline');

/** Scopes whose packages this organisation publishes; only their pins are checked against the registry. */
const PUBLISHED_SCOPES = ['@amerilux/'];
const PACKAGE_FILES = ['package.json', 'api/package.json', 'client/package.json'];
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

/**
 * The template's package.json files carry `{{#if …}}` / `{{/if}}` block markers on their own lines; with those
 * lines removed the rest is valid JSON (string placeholders such as `{{appNameKebab}}` are ordinary values).
 */
function readTemplatePackageFile(relativePath) {
    const source = readFileSync(path.join(templateDir, relativePath), 'utf8');
    const withoutBlockMarkers = source
        .split(/\r?\n/)
        .filter((line) => !/^\s*\{\{[#/][^}]*\}\}\s*$/.test(line))
        .join('\n');
    return JSON.parse(withoutBlockMarkers);
}

/** Every pin in the template, keyed by package name: `[{ file, range }]`. */
function collectPins() {
    const pinsByPackage = new Map();
    for (const relativePath of PACKAGE_FILES) {
        const packageFile = readTemplatePackageFile(relativePath);
        for (const field of DEPENDENCY_FIELDS) {
            for (const [packageName, range] of Object.entries(packageFile[field] ?? {})) {
                if (!pinsByPackage.has(packageName)) pinsByPackage.set(packageName, []);
                pinsByPackage.get(packageName).push({ file: relativePath, range });
            }
        }
    }
    return pinsByPackage;
}

/** The published versions matching `<packageName>@<range>`, or an empty list when none does. */
function publishedVersionsMatching(packageName, range) {
    const result = spawnSync('npm', ['view', `${packageName}@${range}`, 'version', '--json'], {
        encoding: 'utf8',
        shell: isWindows,
    });
    if (result.error) throw result.error;
    const output = result.stdout.trim();
    if (result.status !== 0 || output === '') return [];
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === 'object' && 'error' in parsed) return [];
    return Array.isArray(parsed) ? parsed : [parsed];
}

const failures = [];
const pinsByPackage = collectPins();

for (const [packageName, pins] of pinsByPackage) {
    const distinctRanges = [...new Set(pins.map((pin) => pin.range))];
    if (distinctRanges.length > 1) {
        const where = pins.map((pin) => `${pin.file} pins ${pin.range}`).join(', ');
        failures.push(`${packageName} is pinned differently across workspaces: ${where}.`);
    }
}

if (!offline) {
    for (const [packageName, pins] of pinsByPackage) {
        if (!PUBLISHED_SCOPES.some((scope) => packageName.startsWith(scope))) continue;
        for (const range of new Set(pins.map((pin) => pin.range))) {
            const matching = publishedVersionsMatching(packageName, range);
            const files = pins.filter((pin) => pin.range === range).map((pin) => pin.file).join(', ');
            if (matching.length === 0) {
                failures.push(`${packageName}@${range} (${files}) matches no published version; publish the package, then bump the pin.`);
            } else {
                console.log(`${packageName}@${range} -> ${matching[matching.length - 1]}   (${files})`);
            }
        }
    }
}

if (failures.length > 0) {
    console.error('\nDependency pin check failed:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
}
console.log(`\nDependency pins OK (${pinsByPackage.size} packages across ${PACKAGE_FILES.length} package.json files${offline ? ', registry not checked' : ''}).`);
