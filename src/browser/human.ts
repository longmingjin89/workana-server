import type { Page } from 'playwright';

function triangularRandom(min: number, max: number): number {
  const u = (Math.random() + Math.random()) / 2;
  return min + u * (max - min);
}

export async function randomDelay(min: number, max: number): Promise<void> {
  const ms = triangularRandom(min, max);
  await new Promise(r => setTimeout(r, ms));
}

export async function humanScroll(page: Page): Promise<void> {
  const step = triangularRandom(300, 500);
  await page.mouse.wheel(0, step);
  await randomDelay(800, 2000);

  if (Math.random() < 0.15) {
    const backStep = triangularRandom(100, 200);
    await page.mouse.wheel(0, -backStep);
    await randomDelay(500, 1000);
  }
}

export async function humanMouseMove(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) return;

  const x = triangularRandom(100, viewport.width - 100);
  const y = triangularRandom(100, viewport.height - 100);

  const steps = Math.floor(triangularRandom(10, 25));
  await page.mouse.move(x, y, { steps });
  await randomDelay(200, 600);
}

export async function humanClick(page: Page, selector: string): Promise<void> {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await randomDelay(300, 800);

  if (Math.random() < 0.7) {
    await el.hover();
    await randomDelay(200, 500);
  }

  await el.click();
}

export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.locator(selector).first().click();
  await randomDelay(200, 500);

  for (const char of text) {
    await page.keyboard.type(char, { delay: triangularRandom(50, 150) });
  }
}
