import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
const key = 'stocksense_inventory_v1';
async function login(page: Page, role = 'Inventory Manager') {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(role) }).click();
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory overview.' })).toBeVisible();
}
async function nav(page: Page, label: string) {
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name: label, exact: true })
    .click();
}
async function snapshot(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}
async function selectScope(page: Page, id: string) {
  await page.getByRole('combobox', { name: 'Active warehouse' }).selectOption(id);
}
test('receipt, dispatch, transfer and count keep stock and ledger consistent after reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  await nav(page, 'Receipts');
  await page
    .getByRole('row')
    .filter({ hasText: 'REC-2026-003' })
    .getByRole('button', { name: /Validate/ })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Validate & receive' }).click();
  let state = await snapshot(page);
  expect(state.products.find((p: any) => p.id === 'prod-fst-512').stock).toBe(490);
  expect(state.ledger[0]).toMatchObject({
    referenceId: 'REC-2026-003',
    quantityChange: 150,
    userId: 'USR-001',
  });
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'REC-2026-003' })
      .getByRole('button', { name: /Validate/ }),
  ).toHaveCount(0);
  await nav(page, 'Deliveries');
  await page
    .getByRole('row')
    .filter({ hasText: 'DEL-2026-002' })
    .getByRole('button', { name: 'Dispatch order' })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /Dispatch/ })
    .click();
  state = await snapshot(page);
  expect(state.products.find((p: any) => p.id === 'prod-stl-001').stock).toBe(200);
  await nav(page, 'Transfers');
  await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Transfer completed', exact: true })).toBeDisabled();
  state = await snapshot(page);
  expect(state.products.find((p: any) => p.id === 'prod-stl-001').locationStock).toMatchObject({
    'loc-main': 130,
    'loc-prod': 70,
  });
  expect(state.ledger.filter((entry: any) => entry.referenceId === 'TRF-2026-003')).toHaveLength(1);
  await nav(page, 'Stock counts');
  await page.getByRole('button', { name: /New adjustment|Record count|New count/ }).click();
  await page.getByLabel(/Physical count/).fill('125');
  await page.getByRole('button', { name: /Apply adjustment/ }).click();
  state = await snapshot(page);
  expect(state.products.find((p: any) => p.id === 'prod-stl-001').stock).toBe(195);
  expect(state.ledger[0].quantityChange).toBe(-5);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Inventory overview.' })).toBeVisible();
  expect((await snapshot(page)).products.find((p: any) => p.id === 'prod-stl-001').stock).toBe(195);
  await nav(page, 'Stock ledger');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const path = await (await download).path();
  expect(path).toBeTruthy();
  const csv = await fs.readFile(path!, 'utf8');
  expect(csv).toContain('Recorded quantity');
  expect(csv).toContain('USR-001');
  expect(errors).toEqual([]);
});
test('duplicate-product delivery is blocked in the UI without creating an order', async ({ page }) => {
  await login(page);
  await nav(page, 'Deliveries');
  await page.getByRole('button', { name: 'New delivery', exact: true }).click();
  await page.getByLabel(/Customer/).fill('Duplicate test');
  await page.getByLabel(/Origin warehouse/).selectOption('loc-fg');
  await page.getByLabel('Product on line 1').selectOption('prod-chr-204');
  await page.getByLabel('Quantity on line 1').fill('12');
  await page.getByRole('button', { name: '+ Add item' }).click();
  await page.getByLabel('Product on line 2').selectOption('prod-chr-204');
  await page.getByLabel('Quantity on line 2').fill('12');
  await page.getByRole('button', { name: 'Create delivery', exact: true }).click();
  await expect(page.getByRole('dialog').getByText(/Insufficient stock/)).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
});
test('creation forms create a receipt, preserve unit snapshots and show deletion protection', async ({
  page,
}) => {
  await login(page);
  await nav(page, 'Receipts');
  await page.getByRole('button', { name: 'New receipt', exact: true }).click();
  await page.getByLabel(/Supplier/).fill('Copper, "Parts"\nSupply');
  await page.getByLabel('Product on line 1').selectOption('prod-cop-310');
  await page.getByLabel('Quantity on line 1').fill('5');
  await page.getByRole('button', { name: 'Create receipt', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const state = await snapshot(page);
  expect(state.receipts[0].items[0].unit).toBe('meters');
  await nav(page, 'Products');
  await page.getByRole('row').filter({ hasText: 'Heavy-Duty PVC Pipes' }).click();
  await page.getByRole('button', { name: 'Delete product', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /operation or ledger entry/ })).toBeVisible();
  expect((await snapshot(page)).products.some((p: any) => p.id === 'prod-plm-620')).toBeTruthy();
});
test('warehouse selection is consistent across every feature and resets to all', async ({ page }) => {
  await login(page);
  await selectScope(page, 'loc-prod');
  await expect(page.locator('.metric').first().locator('.metric-value')).toHaveText('03');
  for (const [label, expected] of [
    ['Products', 'Steel Rods'],
    ['Receipts', 'REC-2026-004'],
    ['Deliveries', 'No deliveries'],
    ['Transfers', 'TRF-2026-001'],
    ['Stock counts', 'No adjustments'],
    ['Stock ledger', 'TRF-2026-001'],
  ]) {
    await nav(page, label);
    await expect(page.getByRole('main')).toContainText(expected);
  }
  await nav(page, 'Products');
  await expect(page.getByRole('row').filter({ hasText: 'Office Chairs' })).toHaveCount(0);
  await page.getByRole('row').filter({ hasText: 'Steel Rods' }).click();
  await expect(page.getByRole('dialog').getByText('Main Warehouse', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('Stock at Production Floor');
  await page.getByTitle('Close (Esc)').click();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Active warehouse' })).toHaveValue('loc-prod');
  await nav(page, 'Products');
  await selectScope(page, 'all');
  await expect(page.getByRole('row').filter({ hasText: 'Office Chairs' })).toBeVisible();
  await nav(page, 'Receipts');
  await selectScope(page, 'loc-prod');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await selectScope(page, 'all');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await nav(page, 'Stock ledger');
  await selectScope(page, 'loc-main');
  await expect(page.locator('tbody')).toContainText('-50 kg');
  await selectScope(page, 'all');
  await expect(page.locator('tbody')).toContainText('50 kg moved');
});

test('manager master-data edits preserve stock snapshots and reset preserves account details', async ({
  page,
}) => {
  await login(page);
  await nav(page, 'Settings');
  await page.getByRole('button', { name: 'Add location', exact: true }).click();
  await page.getByLabel(/Location name/).fill('Test bay');
  await page.getByLabel(/Code \(Identifier\)/).fill('TEST-BAY');
  await page.getByRole('dialog').getByRole('button', { name: 'Add location', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'TEST-BAY' })
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await page.getByLabel(/Code \(Identifier\)/).fill('MW-01');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Location code is already in use');
  await page.getByLabel(/Code \(Identifier\)/).fill('TEST-BAY-2');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'TEST-BAY-2' })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'TEST-BAY-2' })).toHaveCount(0);

  await nav(page, 'Products');
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel(/Product name/).fill('Test cable');
  await page.getByLabel(/SKU code/).fill('TEST-CABLE');
  await page.getByLabel(/Category/).fill('Cable');
  await page.getByLabel(/Unit of measure/).selectOption('meters');
  await page.getByLabel(/Initial stock quantity/).fill('10.5');
  await page.getByRole('dialog').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'TEST-CABLE' }).click();
  await page.getByRole('button', { name: 'Edit product', exact: true }).click();
  await page.getByLabel(/Product name/).fill('Test cable revised');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  let state = await snapshot(page);
  expect(state.products.find((p: any) => p.sku === 'TEST-CABLE')).toMatchObject({
    name: 'Test cable revised',
    stock: 10.5,
    unit: 'meters',
  });
  expect(state.ledger[0]).toMatchObject({ productName: 'Test cable', quantityChange: 10.5, unit: 'meters' });

  await page.locator('.account-button').click();
  await page.getByLabel(/Full name/).fill('Manager QA');
  await page.getByRole('button', { name: 'Save details' }).click();
  await nav(page, 'Settings');
  await page.getByRole('button', { name: 'Reset data', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset data', exact: true }).click();
  await page.reload();
  await expect(page.locator('.account-button')).toContainText('Manager QA');
  state = await snapshot(page);
  expect(state.products.some((p: any) => p.sku === 'TEST-CABLE')).toBeFalsy();
});

test('quantity forms preserve decimals and reject zero without silently changing it', async ({ page }) => {
  await login(page);
  await nav(page, 'Transfers');
  await page.getByLabel('Transfer quantity').fill('0.5');
  await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
  let state = await snapshot(page);
  expect(state.transfers[0].quantity).toBe(0.5);
  expect(state.products.find((p: any) => p.id === 'prod-stl-001').locationStock['loc-main']).toBe(199.5);
  await nav(page, 'Stock counts');
  await page.getByRole('button', { name: /New adjustment/ }).click();
  await page.getByLabel(/Physical count/).fill('199.25');
  await page.getByRole('button', { name: /Apply adjustment/ }).click();
  state = await snapshot(page);
  expect(state.adjustments[0]).toMatchObject({ physicalCount: 199.25, difference: -0.25 });
  await nav(page, 'Receipts');
  await page.getByRole('button', { name: 'New receipt', exact: true }).click();
  await page.getByLabel(/Supplier/).fill('Quantity QA');
  await page.getByLabel('Quantity on line 1').fill('0');
  await page.getByRole('button', { name: 'Create receipt', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('All quantities must be greater than zero');
  expect((await snapshot(page)).receipts).toHaveLength(state.receipts.length);
  await page.getByLabel('Quantity on line 1').fill('0.5');
  await page.getByRole('button', { name: 'Create receipt', exact: true }).click();
  expect((await snapshot(page)).receipts[0].items[0].quantity).toBe(0.5);
});
test('staff permissions, truthful recovery, and profile details survive logout and login', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Need account access?' }).click();
  await expect(page.getByText(/OTP delivery is simulated/)).toBeVisible();
  await login(page, 'Warehouse Staff');
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation', exact: true })
      .getByRole('button', { name: 'Settings', exact: true }),
  ).toHaveCount(0);
  await nav(page, 'Products');
  await expect(page.getByRole('button', { name: 'Add product', exact: true })).toHaveCount(0);
  await page.getByRole('row').filter({ hasText: 'Steel Rods' }).click();
  await expect(page.getByRole('button', { name: 'Edit product', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).not.toContainText('Total company stock');
  await expect(page.getByRole('dialog').getByText('Main Warehouse', { exact: true })).toHaveCount(0);
  await page.getByTitle('Close (Esc)').click();
  await nav(page, 'Deliveries');
  await expect(page.getByRole('button', { name: 'New delivery', exact: true })).toHaveCount(0);
  await page.locator('.account-button').click();
  await expect(page.getByLabel(/Email address/)).toHaveAttribute('readonly', '');
  await page.getByLabel(/Full name/).fill('Ravi Count Lead');
  await page.getByRole('button', { name: 'Save details' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
  await page.getByRole('button', { name: /Warehouse Staff/ }).click();
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.locator('.account-button')).toContainText('Ravi Count Lead');
});
test('persistence failure stays on the form and corrupt inventory shows recovery instead of a blank screen', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'stocksense_inventory_v1') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  });
  await nav(page, 'Transfers');
  await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
  await expect(page.getByRole('main')).toContainText('Could not save changes');
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  await page.reload();
  await page.evaluate((key) => localStorage.setItem(key, '{}'), key);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Inventory could not be loaded.' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe('{}');
  await page.getByRole('button', { name: 'Reset demo inventory' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace inventory' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory overview.' })).toBeVisible();
});
test('every screen renders in light and dark; narrow layout keeps navigation usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.screenshot({ path: '.test-artifacts/login-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.screenshot({ path: '.test-artifacts/login-dark.png', fullPage: true });
  await login(page);
  const screens = [
    'Overview',
    'Products',
    'Receipts',
    'Deliveries',
    'Transfers',
    'Stock counts',
    'Stock ledger',
    'Settings',
  ];
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.getByRole('button', { name: 'Switch to light theme' }).click();
    for (const screen of screens) {
      await nav(page, screen);
      await expect(page.locator('main h1')).toBeVisible();
      await page.screenshot({
        path: '.test-artifacts/' + screen.replaceAll(' ', '-').toLowerCase() + '-' + theme + '.png',
        fullPage: true,
      });
    }
    await page.locator('.account-button').click();
    await page.screenshot({ path: '.test-artifacts/profile-' + theme + '.png', fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = page.getByRole('navigation', { name: 'Mobile navigation' });
  for (const screen of ['Transfers', 'Stock counts', 'Stock ledger', 'Settings']) {
    await mobile.getByRole('button', { name: screen, exact: true }).click();
    await expect(page.locator('main h1')).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: '.test-artifacts/mobile-settings.png', fullPage: true });
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
