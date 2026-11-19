import { expect, test, type Page } from './base';
import { TABS, TOURS, type Tab } from '../../src/lib/tour';

// The guided tour in the example (AP-34, board 53). Other tests start with it skipped (playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } });

async function openExample(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
}

const card = (page: Page) => page.getByRole('dialog', { name: 'Tour' });

// Every step's part is on the page and on screen: a feature that moved or went away fails here, so the tour is
// updated with it.
test('every tab plays its tour by itself once, each step on screen, then hands over', async ({ page }) => {
  await openExample(page);
  for (const tab of Object.keys(TOURS) as Tab[]) {
    if (tab !== 'write') await page.getByRole('button', { name: new RegExp(`^${TABS[tab]}`) }).first().click();
    const steps = TOURS[tab];
    for (const [i, step] of steps.entries()) {
      await expect(card(page)).toContainText(`${TABS[tab]} · ${i + 1} of ${steps.length}`);
      await expect(card(page).getByRole('heading', { name: step.title })).toBeVisible();
      const part = page.locator(`[data-tour="${step.target}"]`).first();
      await expect(part).toHaveClass(/tour-on/);
      await expect(part).toBeInViewport();
      // …and not under the top bar, which stays up over the page (an Assets step was ringed there, behind the tabs).
      const hidden = await part.evaluate((el) => {
        const bar = document.querySelector('header');
        return !!bar && !bar.contains(el) && el.getBoundingClientRect().top < bar.getBoundingClientRect().bottom;
      });
      expect(hidden, `${tab} step "${step.title}" is under the top bar`).toBe(false);
      await card(page).getByRole('button', { name: 'Next' }).click();
    }
    await expect(card(page).getByRole('heading', { name: 'Your turn' })).toBeVisible();
    await card(page).getByRole('button', { name: 'Start playing' }).click();
    await expect(card(page)).toHaveCount(0);
  }
  // Seen: going back to a tab doesn't play it again, nor does a reload.
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.reload();
  await expect(page.getByText('Every leaf you have ever seen is running a tiny factory.')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(card(page)).toHaveCount(0);
});

test('Skip tour stops the tours on every tab, and Take the tour plays one again', async ({ page }) => {
  await openExample(page);
  await expect(card(page)).toBeVisible();
  // While a step shows, the page behind can't be clicked.
  await page.getByRole('button', { name: /^Review/ }).first().click({ force: true });
  await expect(card(page)).toContainText('Write · 1 of');
  await page.keyboard.press('ArrowRight');
  await expect(card(page)).toContainText('Write · 2 of');
  await page.keyboard.press('ArrowLeft');
  await expect(card(page)).toContainText('Write · 1 of');
  await card(page).getByRole('button', { name: 'Skip tour' }).click();
  await expect(card(page)).toHaveCount(0);
  for (const tab of ['Review', 'History', 'Assets']) {
    await page.getByRole('button', { name: new RegExp(`^${tab}`) }).first().click();
    await page.waitForTimeout(500);
    await expect(card(page)).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Take the tour' }).click();
  await expect(card(page)).toContainText('Assets · 1 of');
  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
});

test('the tour only shows in the example', async ({ page }) => {
  await openExample(page);
  await expect(card(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await expect(page.getByRole('button', { name: 'Take the tour' })).toHaveCount(0);
});

// The timeline's step opens its drawer to talk about it, and leaving the step folds it again, if it was folded.
test('the timeline step unfolds the drawer, and folds it again after', async ({ page }) => {
  await openExample(page);
  const steps = TOURS.write;
  const at = steps.findIndex((s) => s.target === 'timeline');
  const bar = page.locator('[data-tour="timeline"] .foldbar');
  await expect(card(page)).toContainText('Write · 1 of');
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  for (let i = 0; i < at; i++) await page.keyboard.press('ArrowRight');
  await expect(card(page).getByRole('heading', { name: steps[at].title })).toBeVisible();
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowLeft');
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
  // Skipping on the step folds it too, and the tour never changes what this browser remembers.
  await page.keyboard.press('Escape');
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => localStorage.getItem('timeline-open'))).not.toBe('1');
  // Already open, it stays open.
  await bar.click();
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Take the tour' }).click();
  await expect(card(page)).toContainText('Write · 1 of');
  for (let i = 0; i < at; i++) await page.keyboard.press('ArrowRight');
  await expect(card(page).getByRole('heading', { name: steps[at].title })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(card(page).getByRole('heading', { name: steps[at + 1].title })).toBeVisible();
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
});

// Issue #202: Write's tour ends by opening the ? menu, then showing Feedback mode in use (its strip, and the orange
// outline on a row), so everyone knows it's there. Both go when the step is left, and the tour's keys keep working.
test('the last steps open the ? menu, then show Feedback mode, and put both away after', async ({ page }) => {
  await openExample(page);
  const steps = TOURS.write;
  const menuAt = steps.findIndex((s) => s.show === 'menu');
  const menu = page.getByRole('menu', { name: 'Help and version' });
  const strip = page.locator('[data-tour-clear]');
  await expect(card(page)).toContainText('Write · 1 of');
  for (let i = 0; i < menuAt; i++) await page.keyboard.press('ArrowRight');
  await expect(card(page).getByRole('heading', { name: steps[menuAt].title })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Feedback…' })).toBeVisible();
  await expect(menu).toHaveClass(/tour-on/);
  // Keys pressed fast past the timeline's step: it woke after its drawer slid open and ringed the timeline instead.
  await page.waitForTimeout(400);
  await expect(page.locator('[data-tour="timeline"]')).not.toHaveClass(/tour-on/);
  await expect(menu).toHaveClass(/tour-on/);
  await card(page).getByRole('button', { name: 'Next' }).click();
  await expect(card(page).getByRole('heading', { name: steps[menuAt + 1].title })).toBeVisible();
  await expect(menu).toHaveCount(0);
  await expect(strip).toContainText('click the part that\'s giving you trouble');
  await expect(strip).toBeInViewport();
  // The outline is round a row on screen, as if the pointer were over it.
  const ring = page.locator('[data-feedback-ring]');
  await expect(ring).toHaveCount(1);
  await expect(ring).toBeInViewport();
  // Issue #328: the outlined row is lit (inside the tour's hole), and the card sits above or below it, never under
  // the outline, and clear of the strip.
  await expect(ring).toHaveAttribute('data-tour', 'feedback');
  await page.waitForTimeout(300); // the ring and card glide to the step
  const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
  const r = await box('[data-feedback-ring]'), hole = await box('.tour .hole'), c = await box('.tour [role="dialog"]');
  const s = await box('[data-tour-clear]');
  expect(hole.x).toBeLessThanOrEqual(r.x);
  expect(hole.y).toBeLessThanOrEqual(r.y);
  expect(hole.x + hole.width).toBeGreaterThanOrEqual(r.x + r.width);
  expect(hole.y + hole.height).toBeGreaterThanOrEqual(r.y + r.height);
  expect(c.y >= r.y + r.height || c.y + c.height <= r.y).toBe(true);
  expect(c.y + c.height).toBeLessThanOrEqual(s.y);
  // Nothing is caught: the tour's Back still works, and Feedback mode goes with the step.
  await card(page).getByRole('button', { name: 'Back' }).click();
  await expect(strip).toHaveCount(0);
  await expect(ring).toHaveCount(0);
  await expect(menu).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(card(page).getByRole('heading', { name: 'Your turn' })).toBeVisible();
  await expect(strip).toHaveCount(0);
  await expect(menu).toHaveCount(0);
  await card(page).getByRole('button', { name: 'Start playing' }).click();
  // Skipping on a step puts it away too.
  await page.getByRole('button', { name: 'Take the tour' }).click();
  await expect(card(page)).toContainText('Write · 1 of');
  for (let i = 0; i < menuAt + 1; i++) await page.keyboard.press('ArrowRight');
  await expect(strip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
  await expect(strip).toHaveCount(0);
  // The real Feedback… still starts the real mode.
  await page.getByRole('button', { name: 'Help and version' }).click();
  await page.getByRole('menuitem', { name: 'Feedback…' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'click the part' })).toBeVisible();
});

// Issue #208: the ring stays on its part. In a 1920 × 911 window (the user's) it is round each step's part, all of
// it inside the window (the drawer's lower edge was drawn off screen), and it follows a part that moves without the
// page changing size.
test('the ring sits round each part, inside the window, and follows a part that moves', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 911 });
  await openExample(page);
  const ring = () => page.locator('.tour .hole').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [r.left, r.top, r.right, r.bottom].map(Math.round);
  });
  const part = () => page.evaluate(() => {
    const all = [...document.querySelectorAll('.tour-on')].map((el) => el.getBoundingClientRect());
    const v = document.documentElement;
    return [Math.max(Math.min(...all.map((r) => r.left)) - 6, 3), Math.max(Math.min(...all.map((r) => r.top)) - 6, 3),
      Math.min(Math.max(...all.map((r) => r.right)) + 6, v.clientWidth - 3), Math.min(Math.max(...all.map((r) => r.bottom)) + 6, v.clientHeight - 3)].map(Math.round);
  });
  const steps = TOURS.write;
  for (const [i, step] of steps.entries()) {
    await expect(card(page)).toContainText(`Write · ${i + 1} of ${steps.length}`);
    await expect(card(page).getByRole('heading', { name: step.title })).toBeVisible();
    await expect.poll(async () => JSON.stringify(await ring()) === JSON.stringify(await part()), { message: step.title }).toBe(true);
    const [left, top, right, bottom] = await ring();
    expect(left >= 3 && top >= 3 && right <= 1917 && bottom <= 908, `${step.title}: ring inside the window`).toBe(true);
    if (i === 0) {
      // The row moves 40 px right; the page keeps its size.
      await page.locator('[data-tour="row"]').first().evaluate((el) => ((el as HTMLElement).style.translate = '40px 0'));
      await expect.poll(async () => (await ring())[0]).toBe(left + 40);
      await page.locator('[data-tour="row"]').first().evaluate((el) => ((el as HTMLElement).style.translate = ''));
    }
    await card(page).getByRole('button', { name: 'Next' }).click();
  }
});
