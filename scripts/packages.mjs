// The released packages (every packages/* folder) and the one version they share (ADR 0001).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

/** Every package under packages/, in name order, with its folder. */
export function packages() {
  return readdirSync(new URL('packages/', root), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = new URL(`packages/${entry.name}/`, root);
      const { name, version } = JSON.parse(readFileSync(new URL('package.json', dir), 'utf8'));
      return { name, version, dir: fileURLToPath(dir) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The version every package has: Changesets moves them together (a `fixed` group). Exits when they disagree. */
export function sharedVersion() {
  const all = packages();
  const versions = new Set(all.map(({ version }) => version));
  if (versions.size > 1) {
    console.error('Every package must have the same version, but:');
    for (const { name, version } of all) console.error(`  ${name} is ${version}`);
    console.error('Versions move together through `pnpm changeset version`; see .changeset/config.json.');
    process.exit(1);
  }
  return all[0].version;
}
