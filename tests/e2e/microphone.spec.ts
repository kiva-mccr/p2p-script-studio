import { readFileSync } from 'node:fs';
import { expect, test } from './base';
import { setUp } from './folder';

// The real microphone path of Follow my voice (no stand-in), with Chromium's made-up microphone: the sound tap is set
// up before the model loads, and the page's policy must allow it. An AudioWorklet made from a blob: was refused on the
// live site (the user, 2026-11-19); the base test fails on any refusal. The test build has no model files, so it ends
// at the download. Its own file: the made-up microphone needs the browser started with it.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['microphone'] });

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

test('Follow my voice: the real microphone path runs under the policy', async ({ page }) => {
  const violations: string[] = [];
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.log('refused', e.effectiveDirective)));
  page.on('console', (m) => m.text().startsWith('refused') && violations.push(m.text()));
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Teleprompter' }).click();
  const prompter = page.getByRole('dialog', { name: 'Teleprompter' });
  await prompter.getByLabel('Follow my voice').check();
  await expect(prompter.getByRole('alert')).toHaveText(/couldn't be downloaded/, { timeout: 15000 });
  expect(violations).toEqual([]);
});
