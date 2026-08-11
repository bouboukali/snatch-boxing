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

// ===== CHAMPS OBLIGATOIRES — FORMULAIRE AJOUT BOXEUR =====
test.describe('Validation champs obligatoires — ajout boxeur', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.dash-kpi-row', { timeout: 8000 });
    await page.evaluate(() => { (window as any).showPage('coach-boxers'); });
    await page.waitForSelector('#coachBoxersPage', { timeout: 5000 });
    await page.evaluate(() => { (window as any).openCreateBoxerModal(); });
    await page.waitForSelector('.modal-overlay.open', { timeout: 3000 });
  });

  test('les champs obligatoires affichent un astérisque rouge', async ({ page }) => {
    const stars = page.locator('.required-star');
    const count = await stars.count();
    expect(count).toBeGreaterThanOrEqual(3); // email, prénom, nom
  });

  test('note "champs obligatoires" visible en haut du formulaire', async ({ page }) => {
    await expect(page.locator('text=obligatoires')).toBeVisible();
  });

  test('erreur si on soumet sans prénom ni nom', async ({ page }) => {
    await page.locator('#nb_email').fill('test@boxing.fr');
    // prénom et nom vides — clic sur Créer
    const modalBody = page.locator('.modal-body');
    await modalBody.evaluate(el => el.scrollTo(0, el.scrollHeight));
    await page.locator('button:has-text("Créer")').click();
    await expect(page.locator('.error-msg')).toBeVisible();
  });
});

// ===== CHANGEMENT EMAIL — PROFIL BOXEUR =====
test.describe('Changement email — profil boxeur', () => {
  test.beforeEach(async ({ page }) => {
    // Injection d'un token boxer
    await page.goto('/');
    await page.evaluate(async () => {
      const secret = 'boxing-secret-2024';
      async function makeJWT(payload: any) {
        const enc = (s: string) => btoa(JSON.stringify(s)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
        const header = enc({alg:'HS256',typ:'JWT'});
        const body = enc(payload);
        const data = header + '.' + body;
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
        return data + '.' + btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
      }
      const token = await makeJWT({id:1, email:'boxer@boxing.fr', role:'boxer', exp: Math.floor(Date.now()/1000)+3600});
      localStorage.setItem('bm_token', token);
      localStorage.setItem('bm_role', 'boxer');
      localStorage.setItem('bm_email', 'boxer@boxing.fr');
    });
    await page.reload();
    await page.waitForSelector('.dash-kpi-row', { timeout: 8000 });
    await page.evaluate(() => { (window as any).showPage('boxer-profile'); });
    await page.waitForSelector('#page-boxer-profile', { timeout: 5000 });
  });

  test('bouton Changer visible à côté du champ email', async ({ page }) => {
    await expect(page.locator('button:has-text("Changer")')).toBeVisible();
  });

  test('formulaire de changement s\'ouvre au clic', async ({ page }) => {
    await page.locator('button:has-text("Changer")').click();
    await expect(page.locator('#emailChangeForm')).toBeVisible();
    await expect(page.locator('#newEmailInput')).toBeVisible();
  });

  test('formulaire se ferme au clic Annuler', async ({ page }) => {
    await page.locator('button:has-text("Changer")').click();
    await page.locator('button:has-text("Annuler")').click();
    await expect(page.locator('#emailChangeForm')).toBeHidden();
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
