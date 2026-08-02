#!/usr/bin/env node
// Guard the `shared/` symlinks.
//
// A handful of files are shared between packages by SYMLINK rather than by copy: one real
// file in `shared/`, symlinked into each package's `src/`. That keeps every core genuinely
// zero-dep — each bundler inlines the file, so nothing depends on a sibling at runtime —
// while making divergence impossible rather than merely detectable.
//
// The failure mode this exists for: git on Windows checks symlinks out as PLAIN TEXT FILES
// containing the target path, unless `core.symlinks=true` and the user has Developer Mode
// or admin rights. Without this check that surfaces as a baffling build error about a
// module whose contents are the string `../../../shared/color.ts`. With it, you get told.
//
// It also catches the two cheaper mistakes: a symlink pointing somewhere that no longer
// exists, and a package quietly reverting to its own copy.
import { readdirSync, readlinkSync, lstatSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Which packages each shared file must be symlinked into. Adding a shared file means
// adding it here, so the map doubles as the inventory.
const EXPECTED = {
	'color.ts': [
		'crt',
		'flip-dot',
		'led-grid',
		'neon',
		'nixie',
		'seven-segment',
		'split-flap',
		'vfd'
	],
	'sound.ts': ['flip-dot', 'neon', 'split-flap'],
	'font5x7.ts': ['extras', 'vfd'],
	'path-parse.ts': ['neon', 'vfd']
};

const problems = [];

// Every shared file is accounted for, and nothing is in `shared/` that no one uses.
const onDisk = readdirSync(join(root, 'shared')).filter((f) => f.endsWith('.ts'));
for (const f of onDisk) {
	if (!EXPECTED[f]) problems.push(`shared/${f} is not listed in scripts/check-shared.mjs`);
}
for (const f of Object.keys(EXPECTED)) {
	if (!onDisk.includes(f)) problems.push(`shared/${f} is listed but missing from disk`);
}

for (const [file, pkgs] of Object.entries(EXPECTED)) {
	const target = join(root, 'shared', file);
	for (const pkg of pkgs) {
		const link = join(root, 'packages', pkg, 'src', file);
		if (!existsSync(link)) {
			problems.push(`packages/${pkg}/src/${file} is missing (should link to shared/${file})`);
			continue;
		}
		if (!lstatSync(link).isSymbolicLink()) {
			problems.push(
				`packages/${pkg}/src/${file} is a real file, not a symlink to shared/${file}.\n` +
					`    On Windows this is what git does to symlinks unless core.symlinks=true and you\n` +
					`    have Developer Mode on: run \`git config core.symlinks true\` and re-checkout.`
			);
			continue;
		}
		const points = resolve(dirname(link), readlinkSync(link));
		if (points !== target) {
			problems.push(
				`packages/${pkg}/src/${file} points at ${relative(root, points)}, expected shared/${file}`
			);
		}
	}
}

if (problems.length) {
	console.error('check-shared: the shared-source symlinks are wrong.\n');
	for (const p of problems) console.error(`  - ${p}`);
	console.error('\nSee CLAUDE.md → Conventions → Shared sources.');
	process.exit(1);
}
console.log(
	`check-shared: OK — ${onDisk.length} shared files, ` +
		`${Object.values(EXPECTED).flat().length} symlinks.`
);
