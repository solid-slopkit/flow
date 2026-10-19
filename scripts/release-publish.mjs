// Publishes every package, as `pnpm release:check` built it, to npm (ADR 0001). npm, not pnpm, does the upload: it
// authenticates through trusted publishing in GitHub Actions. A version that is already on npm is skipped, so the
// release workflow can be rerun after a later step failed.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { packages, sharedVersion } from './packages.mjs';

const version = sharedVersion();

/** Whether `name@version` is on the registry. `npm view` prints nothing for a missing version of a known package. */
function published(name) {
  try {
    return execFileSync('npm', ['view', `${name}@${version}`, 'version'], { encoding: 'utf8' }).trim() === version;
  } catch {
    return false; // E404: the package itself isn't on npm yet.
  }
}

for (const { name, dir } of packages()) {
  if (published(name)) {
    console.log(`${name}@${version} is already on npm, skipping.`);
    continue;
  }
  if (!existsSync(join(dir, 'dist'))) {
    console.error(`${name} isn't built: run \`pnpm release:check\` first.`);
    process.exit(1);
  }
  execFileSync('npm', ['publish'], { cwd: dir, stdio: 'inherit' });
  console.log(`Published ${name}@${version}`);
}
