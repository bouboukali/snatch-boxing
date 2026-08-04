import { test as setup } from '@playwright/test';
import jwt from 'jsonwebtoken';
import * as fs from 'fs';

// Génère un token coach valide sans passer par le formulaire de login
setup('generate coach auth state', async ({ page }) => {
  const secret = process.env.JWT_SECRET || 'boxing-secret-2024';
  const token = jwt.sign(
    { id: 999, email: process.env.COACH_EMAIL || 'coach@boxing.fr', role: 'coach' },
    secret,
    { expiresIn: '1h' }
  );

  await page.goto('/');

  await page.evaluate((t) => {
    localStorage.setItem('bm_token', t);
    localStorage.setItem('bm_role', 'coach');
    localStorage.setItem('bm_email', 'coach@boxing.fr');
  }, token);

  await page.context().storageState({ path: 'e2e/auth-coach.json' });
});
