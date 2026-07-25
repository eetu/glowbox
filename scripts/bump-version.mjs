#!/usr/bin/env node
// Bump every @glowbox/* package to the given version, in lockstep (the release
// workflow requires the tag to match ALL six). Leaves the CHANGELOG entry to you.
//
//   node scripts/bump-version.mjs 1.1.1
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
	console.error('usage: node scripts/bump-version.mjs <semver, e.g. 1.1.1 or 1.2.0-rc.1>');
	process.exit(1);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const packagesDir = join(root, 'packages');
for (const name of readdirSync(packagesDir)) {
	const file = join(packagesDir, name, 'package.json');
	const pkg = JSON.parse(readFileSync(file, 'utf8'));
	const from = pkg.version;
	pkg.version = version;
	writeFileSync(file, JSON.stringify(pkg, null, '\t') + '\n');
	console.log(`${pkg.name}: ${from} -> ${version}`);
}
console.log(`\nnow: add the CHANGELOG heading, commit, then tag v${version} on main to publish.`);
