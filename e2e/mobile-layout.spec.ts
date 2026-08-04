import { test, expect } from '@playwright/test';

// ===== DASHBOARD =====
test.describe('Dashboard mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Attend que l'app soit initialisée (dashboard chargé)
    await page.waitForSelector('.dash-kpi-row', { timeout: 8000 });
  });

  test('affiche 3 cartes KPI côte à côte', async ({ page }) => {
    const kpis = page.locator('.dash-kpi');
    await expect(kpis).toHaveCount(3);

    // Vérifie qu'elles sont bien sur la même ligne (même top approximatif)
    const boxes = await kpis.evaluateAll(els =>
      els.map(el => el.getBoundingClientRect().top)
    );
    const topDiff = Math.max(...boxes) - Math.min(...boxes);
    expect(topDiff).toBeLessThan(10); // toutes à moins de 10px de hauteur
  });

  test('les KPI ne débordent pas de l\'écran', async ({ page }) => {
    const row = page.locator('.dash-kpi-row');
    const box = await row.boundingBox();
    const viewport = page.viewportSize();
    expect(box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.x).toBeGreaterThanOrEqual(0);
  });

  test('affiche les prochains événements', async ({ page }) => {
    await expect(page.locator('.dash-cols')).toBeVisible();
  });

  test('screenshot dashboard', async ({ page }) => {
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: false,
      maxDiffPixels: 200,
    });
  });
});

// ===== MES BOXEURS =====
test.describe('Boxeurs mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.dash-kpi-row', { timeout: 8000 });
    // Navigation vers Mes boxeurs
    await page.evaluate(() => { (window as any).showPage('coach-boxers'); });
    await page.waitForSelector('#coachBoxersPage', { timeout: 5000 });
  });

  test('page visible sans scroll horizontal', async ({ page }) => {
    const body = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
    }));
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 2);
  });

  test('bouton Ajouter visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Ajouter")')).toBeVisible();
  });

  test('screenshot liste boxeurs', async ({ page }) => {
    await expect(page).toHaveScreenshot('boxeurs.png', {
      fullPage: false,
      maxDiffPixels: 200,
    });
  });
});

// ===== MODAL NOUVEAU BOXEUR =====
test.describe('Modal ajout boxeur mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.dash-kpi-row', { timeout: 8000 });
    await page.evaluate(() => { (window as any).showPage('coach-boxers'); });
    await page.waitForSelector('#coachBoxersPage', { timeout: 5000 });
    await page.locator('button:has-text("Ajouter")').first().click();
    await page.waitForSelector('.modal-overlay.open', { timeout: 3000 });
  });

  test('modal visible et header sticky', async ({ page }) => {
    await expect(page.locator('.modal-overlay.open')).toBeVisible();
    await expect(page.locator('.modal-header')).toBeVisible();
  });

  test('modal ne dépasse pas la hauteur de l\'écran', async ({ page }) => {
    const modal = page.locator('.modal');
    const box = await modal.boundingBox();
    const viewport = page.viewportSize();
    expect(box!.height).toBeLessThanOrEqual(viewport!.height);
  });

  test('champs avec placeholders belges', async ({ page }) => {
    await expect(page.locator('input[placeholder="+32 4 00 00 00 00"]')).toBeVisible();
    await expect(page.locator('input[placeholder="KBBB-2024-XXXXX"]')).toBeVisible();
  });

  test('bouton Créer accessible en scrollant', async ({ page }) => {
    const modalBody = page.locator('.modal-body');
    await modalBody.evaluate(el => el.scrollTo(0, el.scrollHeight));
    await expect(page.locator('button:has-text("Créer")')).toBeVisible();
  });

  test('screenshot modal ajout boxeur', async ({ page }) => {
    await expect(page).toHaveScreenshot('modal-nouveau-boxeur.png', {
      fullPage: false,
      maxDiffPixels: 200,
    });
  });
});

// ===== NAVIGATION MOBILE =====
test.describe('Navigation mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.dash-kpi-row', { timeout: 8000 });
  });

  test('hamburger visible sur mobile', async ({ page }) => {
    await expect(page.locator('.hamburger')).toBeVisible();
  });

  test('sidebar cachée par défaut', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    const box = await sidebar.boundingBox();
    // La sidebar est hors écran (translateX(-100%))
    expect(box!.x).toBeLessThan(0);
  });

  test('sidebar s\'ouvre au clic hamburger', async ({ page }) => {
    await page.locator('.hamburger').click();
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toHaveClass(/open/);
  });
});
