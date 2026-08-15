// Runs every pgTAP test file in supabase/tests/database/ directly against
// the linked Supabase project (`supabase db query --linked -f <file>`) —
// no Docker/psql needed. Each file wraps its assertions in
// `begin ... rollback`, so nothing is left behind in the shared dev DB.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const testDir = path.join(process.cwd(), 'supabase', 'tests', 'database');
const files = readdirSync(testDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error(`No .sql test files found in ${testDir}`);
  process.exit(1);
}

// Prefer a directly-installed `supabase` (what supabase/setup-cli@v1 puts on
// PATH in CI) over `npx supabase` — npx's own resolution/download behavior
// is an extra variable we don't need, and this is the CLI's own documented
// usage pattern. Falls back to npx for local dev, where there's usually no
// global install.
const hasGlobalCli = spawnSync('supabase', ['--version'], { encoding: 'utf-8', shell: true }).status === 0;
const [cliCmd, cliBaseArgs] = hasGlobalCli ? ['supabase', []] : ['npx', ['supabase']];

let anyFailed = false;

for (const file of files) {
  const relPath = path.join('supabase', 'tests', 'database', file);
  console.log(`\n=== ${file} ===`);

  const result = spawnSync(
    cliCmd,
    [...cliBaseArgs, 'db', 'query', '--linked', '--output-format', 'json', '-f', relPath],
    { encoding: 'utf-8', shell: true }
  );

  if (result.error) {
    console.error(`  Failed to run: ${result.error.message}`);
    anyFailed = true;
    continue;
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    console.error('  Could not parse CLI output as JSON:');
    console.error(result.stdout || result.stderr);
    anyFailed = true;
    continue;
  }

  if (parsed?._tag === 'Error') {
    console.error(`  Query error: ${parsed.error?.message ?? JSON.stringify(parsed.error)}`);
    anyFailed = true;
    continue;
  }

  // `db query --output-format json` prints a bare JSON array of row
  // objects. (An earlier version of this script expected a
  // `{ rows: [...] }` wrapper, which turned out to be an artifact of the
  // interactive tool sandbox this was first validated in, not real CLI
  // output — CI showed the bare-array shape all along.)
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : [];
  if (rows.length === 0) {
    console.error('  No TAP output returned — check the test file ends with `select * from pgtap_output;`.');
    console.error('  Raw CLI response for diagnosis:');
    console.error('  ' + JSON.stringify(parsed));
    if (result.stderr) {
      console.error('  stderr:');
      console.error('  ' + result.stderr.trim());
    }
    anyFailed = true;
    continue;
  }

  let fileFailed = false;
  for (const row of rows) {
    const line = row.line ?? '';
    console.log(`  ${line}`);
    if (/^not ok\b/.test(line)) fileFailed = true;
  }

  if (fileFailed) anyFailed = true;
}

console.log('');
if (anyFailed) {
  console.error('pgTAP: one or more tests failed.');
  process.exit(1);
} else {
  console.log('pgTAP: all tests passed.');
}
