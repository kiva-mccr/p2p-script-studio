import { expect, test } from './base';

// The Content Security Policy (SE-1): the built page carries it, the browser enforces it, and nothing the example does
// sends anything to another site.

// The one other site: Hugging Face, for the speech models (the example's cuts on a word ask for Whisper's files).
const MODELS = /^https:\/\/(huggingface\.co|[^/]+\.hf\.co)\//;

test('the page carries the policy, and nothing is sent to another site', async ({ page }) => {
  const elsewhere: string[] = [];
  await page.context().route(MODELS, (route) => route.abort()); // never downloaded in tests
  page.context().on('request', (r) => {
    const url = new URL(r.url());
    if (url.hostname === 'localhost' || ['blob:', 'data:'].includes(url.protocol)) return;
    if (!MODELS.test(r.url()) || r.method() !== 'GET' || r.postData()) elsewhere.push(`${r.method()} ${r.url()}`);
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
