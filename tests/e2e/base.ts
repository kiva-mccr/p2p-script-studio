import { expect, test as base } from '@playwright/test';

// Every e2e test imports `test` from here (SE-1): a test fails if the page broke the Content Security Policy, so a
// feature that needs something the policy refuses is caught before it reaches people's browsers.
export * from '@playwright/test';

export const test = base.extend<{ policyWatch: void; refusalsExpected: boolean }>({
  refusalsExpected: [false, { option: true }], // only policy.spec's own check of the policy sets it
  policyWatch: [
    async ({ context, refusalsExpected }, use) => {
      const broken: string[] = [];
      context.on('console', (m) => {
        if (/Content Security Policy/i.test(m.text())) broken.push(m.text());
      });
      await use();
      if (!refusalsExpected) expect(broken, 'Content Security Policy refusals').toEqual([]);
    },
    { auto: true },
  ],
});
