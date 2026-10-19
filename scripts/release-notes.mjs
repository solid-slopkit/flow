// Prints the GitHub Release notes for the shared version (ADR 0001): each package's section of its CHANGELOG.md, which
// `pnpm changeset version` wrote. Packages with nothing new in this version are left out.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { packages, sharedVersion } from './packages.mjs';

const version = sharedVersion();
const sections = [];
for (const { name, dir } of packages()) {
  const changelog = join(dir, 'CHANGELOG.md');
  if (!existsSync(changelog)) continue;
  // The lines after "## <version>", up to the next version's heading.
  const lines = readFileSync(changelog, 'utf8').split('\n');
  const start = lines.indexOf(`## ${version}`);
  if (start === -1) continue;
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  const body = lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim();
  if (body && body !== 'No changes in this release.') sections.push(`## ${name}\n\n${body.replaceAll(/^### /gm, '#### ')}`);
}
console.log(sections.length ? sections.join('\n\n') : 'No changes in this release.');
