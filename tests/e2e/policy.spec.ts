import { expect, test } from './base';
import { setUp } from './folder';

// The Content Security Policy (SE-1): the built page carries it, the browser enforces it, and nothing the example does
// sends anything to another site.

test('the page carries the policy, and nothing is sent to another site', async ({ page }) => {
  const elsewhere: string[] = [];
  page.context().on('request', (r) => {
    const url = new URL(r.url());
    if (url.hostname === 'localhost' || ['blob:', 'data:'].includes(url.protocol)) return;
    elsewhere.push(`${r.method()} ${r.url()}`); // not even Hugging Face: the speech models come from the app (SE-5)
  });
  await page.goto('./');
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("default-src 'none'");
  expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');

  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('Sent for review').first()).toBeVisible();
  expect(elsewhere).toEqual([]);
});

test.describe(() => {
  test.use({ refusalsExpected: true });

  test("the app's script and stylesheet carry integrity hashes, and a changed script is refused (SE-9)", async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'Open the example' })).toBeVisible();
    for (const el of await page.locator('script[src^="./assets/"], link[rel="stylesheet"][href^="./assets/"]').all())
      expect(await el.getAttribute('integrity')).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/);

    // The same page with one byte of its script changed on the way: the browser runs none of it.
    await page.route(/\/assets\/index-[^/]+\.js$/, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: (await res.text()) + '\n' });
    });
    await page.reload();
    await expect(page.locator('#app')).toBeEmpty();
  });

  test('the browser refuses a script, a stylesheet and a send the policy does not allow', async ({ page }) => {
    await page.goto('./');
    const refused = await page.evaluate(async () => {
      const seen: string[] = [];
      document.addEventListener('securitypolicyviolation', (e) => seen.push(e.effectiveDirective));
      const script = document.createElement('script');
      script.textContent = 'window.ran = true';
      document.head.append(script);
      const style = document.createElement('style');
      style.textContent = 'body { color: red }';
      document.head.append(style);
      await fetch('https://example.com/', { method: 'POST', body: 'x' }).catch(() => {});
      await new Promise((r) => setTimeout(r, 200));
      return { seen, ran: (window as unknown as { ran?: boolean }).ran ?? false };
    });
    expect(refused.ran).toBe(false);
    expect(refused.seen).toEqual(expect.arrayContaining(['script-src-elem', 'style-src-elem', 'connect-src']));
  });
});

test('a picture linked from another site is never loaded: its link shows, with no preview (the user, 2026-11-18)', async ({ page }) => {
  const elsewhere: string[] = [];
  page.context().on('request', (r) => {
    if (r.url().startsWith('https://example.com/')) elsewhere.push(r.url());
  });
  const script = '---\ntitle: Linked\n---\n\n# Files\n\n## 1\nDialogue:\nA leaf.\n\nOn screen:\nThe leaf.\n\nFiles:\n- [Leaf photo](https://example.com/leaf.jpg)\n';
  await setUp(page, '', { 'Linked/script.md': script });
  await page.getByText('Linked').click();
  await expect(page.getByRole('link', { name: 'Leaf photo' })).toBeVisible();
  await expect(page.locator('img[src^="https://example.com"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Print…' }).click();
  await expect(page.locator('img[src^="https://example.com"]')).toHaveCount(0);
  expect(elsewhere).toEqual([]);
});
