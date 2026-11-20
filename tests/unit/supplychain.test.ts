import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// SE-2: every GitHub Action the workflows use is pinned to a commit (a tag can be moved to other code), with the
// version beside it for Dependabot and people; checkouts keep no token on disk; the Tests check runs npm audit.
const dir = '.github/workflows';
const workflows = readdirSync(dir)
  .filter((f) => f.endsWith('.yml'))
  .map((f) => ({ name: f, text: readFileSync(`${dir}/${f}`, 'utf8') }));

describe('supply chain (SE-2)', () => {
  it('pins every action to a full commit hash, with its version as a comment', () => {
    const uses = workflows.flatMap((w) => [...w.text.matchAll(/uses:\s*(\S+)(.*)/g)].map((m) => `${w.name}: ${m[1]}${m[2]}`));
    expect(uses.length).toBeGreaterThan(10);
    for (const line of uses) expect(line).toMatch(/@[0-9a-f]{40} # v\d+(\.\d+)*$/);
  });

  it('checks out without keeping credentials, and gives each workflow only the permissions it names', () => {
    for (const w of workflows) {
      expect(w.text, w.name).toMatch(/^permissions:/m);
      const checkouts = w.text.match(/uses: actions\/checkout@.*\n.*/g) ?? [];
      for (const c of checkouts) expect(c, w.name).toContain('persist-credentials: false');
    }
  });

  it('audits what ships to browsers in the Tests check, and Dependabot watches npm and Actions', () => {
    expect(readFileSync(`${dir}/tests.yml`, 'utf8')).toContain('npm audit --omit=dev');
    const dependabot = readFileSync('.github/dependabot.yml', 'utf8');
    expect(dependabot).toContain('package-ecosystem: npm');
    expect(dependabot).toContain('package-ecosystem: github-actions');
  });
});
