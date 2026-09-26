import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import type { InventorySnapshot } from '../../src/types';

async function nav(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name, exact: true })
    .click();
}
async function login(page: Page, role = 'Inventory Manager') {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(role) }).click();
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory overview.' })).toBeVisible();
}
async function inventory(page: Page): Promise<InventorySnapshot> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('stocksense_inventory_v1')!));
}
async function metric(page: Page, label: string, value: string) {
  await expect(page.locator('.metric').filter({ hasText: label }).locator('.metric-value')).toHaveText(value);
}

test('complete original problem-statement walkthrough', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  await metric(page, 'Products in stock', '09');
  await metric(page, 'Transfers scheduled', '01');
  await nav(page, 'Products');
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel(/Product name/).fill('Compliance steel');
  await page.getByLabel(/SKU code/).fill('QA-STL');
  await page.getByLabel('Category *', { exact: true }).fill('Compliance');
  await page.getByLabel(/Unit of measure/).selectOption('kg');
  await page.getByLabel(/Initial stock quantity/).fill('');
  await page.getByLabel(/Reorder level/).fill('10');
  await page.getByRole('dialog').getByRole('button', { name: 'Add product', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  let state = await inventory(page);
  const productId = state.products[0].id;
  expect(state.products[0].stock).toBe(0);

  await nav(page, 'Receipts');
  await page.getByRole('button', { name: 'New receipt', exact: true }).click();
  await page.getByLabel(/Supplier/).fill('QA supplier');
  await page.getByLabel('Initial status').selectOption('Waiting');
  await page.getByLabel('Product on line 1').selectOption(productId);
  await page.getByLabel('Quantity on line 1').fill('50');
  await page.getByRole('button', { name: 'Create receipt', exact: true }).click();
  state = await inventory(page);
  const receiptId = state.receipts[0].id;
  await page
    .getByRole('row')
    .filter({ hasText: receiptId })
    .getByRole('button', { name: /Validate/ })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Validate & receive' }).click();
  expect((await inventory(page)).products.find((p) => p.id === productId)!.stock).toBe(50);

  await nav(page, 'Products');
  await page.getByRole('row').filter({ hasText: 'QA-STL' }).click();
  await page.getByRole('button', { name: 'Edit product', exact: true }).click();
  await page.getByLabel(/Product name/).fill('Compliance steel revised');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await nav(page, 'Transfers');
  await page.getByLabel(/Select product/).selectOption(productId);
  await page.getByLabel('From location').selectOption('loc-main');
  await page.getByLabel('To location').selectOption('loc-prod');
  await page.getByLabel('Transfer quantity').fill('20');
  await page.getByRole('button', { name: 'Schedule transfer', exact: true }).click();
  state = await inventory(page);
  const transferId = state.transfers[0].id;
  expect(state.transfers[0].status).toBe('Waiting');
  expect(state.products.find((p) => p.id === productId)!.locationStock).toEqual({ 'loc-main': 50 });
  await nav(page, 'Overview');
  await page.getByRole('combobox', { name: 'Document type', exact: true }).selectOption('Transfer');
  await page.getByRole('combobox', { name: 'Document status', exact: true }).selectOption('Waiting');
  await page.getByRole('combobox', { name: 'Product category', exact: true }).selectOption('Compliance');
  await page.getByRole('combobox', { name: 'Warehouse / location', exact: true }).selectOption('loc-main');
  await metric(page, 'Transfers scheduled', '01');
  await metric(page, 'Open receipts', '00');
  await expect(page.locator('.queue-row')).toHaveCount(1);
  await expect(page.locator('.queue-row')).toContainText(transferId);
  await page.getByRole('combobox', { name: 'Document status', exact: true }).selectOption('Done');
  await expect(page.locator('.queue-row')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Active warehouse' }).selectOption('all');
  await nav(page, 'Transfers');
  await page
    .getByRole('row')
    .filter({ hasText: transferId })
    .getByRole('button', { name: 'Execute', exact: true })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /Execute/ })
    .click();
  state = await inventory(page);
  expect(state.products.find((p) => p.id === productId)).toMatchObject({
    stock: 50,
    locationStock: { 'loc-main': 30, 'loc-prod': 20 },
  });

  await nav(page, 'Deliveries');
  await page.getByRole('button', { name: 'New delivery', exact: true }).click();
  await page.getByLabel(/Customer/).fill('QA customer');
  await page.getByLabel(/Origin warehouse/).selectOption('loc-prod');
  await page.getByLabel('Product on line 1').selectOption(productId);
  await page.getByLabel('Quantity on line 1').fill('21');
  await page.getByRole('button', { name: 'Create delivery', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Insufficient stock');
  await page.getByLabel('Quantity on line 1').fill('10');
  await page.getByRole('button', { name: 'Create delivery', exact: true }).click();
  state = await inventory(page);
  const deliveryId = state.deliveries[0].id;
  const delivery = page.getByRole('row').filter({ hasText: deliveryId });
  await expect(delivery).toContainText('Draft');
  await delivery.getByRole('button', { name: 'Pick items', exact: true }).click();
  await expect(delivery).toContainText('Picked');
  expect((await inventory(page)).products.find((p) => p.id === productId)!.stock).toBe(50);
  await delivery.getByRole('button', { name: 'Pack items', exact: true }).click();
  await expect(delivery).toContainText('Packed');
  await delivery.getByRole('button', { name: 'Dispatch order', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /Dispatch/ })
    .click();
  expect((await inventory(page)).products.find((p) => p.id === productId)).toMatchObject({
    stock: 40,
    locationStock: { 'loc-main': 30, 'loc-prod': 10 },
  });

  await nav(page, 'Stock counts');
  await page.getByRole('button', { name: 'New adjustment', exact: true }).click();
  await page.getByLabel(/Select product/).selectOption(productId);
  await page.getByRole('combobox', { name: 'Location *', exact: true }).selectOption('loc-main');
  await expect(page.getByLabel('Physical count', { exact: true })).toHaveValue('30');
  await page.getByLabel('Physical count', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Apply adjustment', exact: true }).click();
  state = await inventory(page);
  expect(state.products.find((p) => p.id === productId)).toMatchObject({
    stock: 15,
    locationStock: { 'loc-main': 5, 'loc-prod': 10 },
  });
  const movements = state.ledger.filter((entry) => entry.productId === productId);
  expect(movements.map((entry) => entry.quantityChange)).toEqual([-25, -10, 20, 50]);
  expect(movements.at(-1)!.productName).toBe('Compliance steel');
  expect(movements.every((entry) => entry.unit === 'kg')).toBeTruthy();

  await nav(page, 'Overview');
  await page.getByRole('combobox', { name: 'Warehouse / location', exact: true }).selectOption('loc-main');
  await page.getByRole('combobox', { name: 'Product category', exact: true }).selectOption('Compliance');
  await metric(page, 'Stock alerts', '01');
  await expect(page.getByRole('row').filter({ hasText: 'QA-STL' })).toContainText('Low stock');
  await page.getByRole('button', { name: 'Operational alerts' }).click();
  await expect(page.locator('.alerts-popover')).toContainText('products at or below reorder');
  await page.getByRole('button', { name: 'Operational alerts' }).click();

  await nav(page, 'Products');
  await page.getByPlaceholder('Search products or SKU...').fill('qa-stl');
  await page.getByLabel('Product category filter').selectOption('Compliance');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('5');
  await page.getByRole('combobox', { name: 'Active warehouse' }).selectOption('loc-prod');
  await expect(page.locator('tbody')).toContainText('10');
  await page.getByRole('combobox', { name: 'Active warehouse' }).selectOption('all');
  await nav(page, 'Stock ledger');
  await page.getByLabel('Search ledger').fill('QA-STL');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csv = await fs.readFile((await (await downloaded).path())!, 'utf8');
  expect(csv).toContain('QA-STL');
  expect(csv).toContain('USR-001');
  expect(csv).toContain('-25');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Inventory overview.' })).toBeVisible();
  expect(await inventory(page)).toEqual(state);

  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
  await page.getByRole('button', { name: /Warehouse Staff/ }).click();
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await nav(page, 'Products');
  await expect(page.getByRole('button', { name: 'Add product', exact: true })).toHaveCount(0);
  await nav(page, 'Deliveries');
  await expect(page.getByRole('button', { name: 'New delivery', exact: true })).toHaveCount(0);
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation', exact: true })
      .getByRole('button', { name: 'Settings', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();

  await page.getByRole('button', { name: 'Need account access?' }).click();
  await page.getByLabel('Email address', { exact: true }).fill('staff@stocksense.demo');
  await page.getByRole('button', { name: 'Generate demo OTP' }).click();
  const code = await page.getByTestId('demo-otp').innerText();
  await page.getByLabel('One-time code', { exact: true }).fill(code === '000000' ? '111111' : '000000');
  await page.getByLabel('New demo password', { exact: true }).fill('NewStaffDemo123');
  await page.getByRole('button', { name: 'Change demo password' }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect reset code');
  await page.getByLabel('One-time code', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Change demo password' }).click();
  await expect(page.getByRole('button', { name: 'Open workspace' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Warehouse Staff/ }).click();
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
  await page.getByLabel('Password', { exact: true }).fill('NewStaffDemo123');
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory overview.' })).toBeVisible();
  expect(await inventory(page)).toEqual(state);
  expect(errors).toEqual([]);
});

test('signup, profile, registered-role permissions, duplicate email and reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('New warehouse operator');
  await page.getByRole('combobox', { name: 'Demo role', exact: true }).selectOption('Warehouse Staff');
  await page.getByRole('combobox', { name: 'Assigned warehouse', exact: true }).selectOption('loc-rack-a');
  await page.getByLabel('Email address', { exact: true }).fill('new-operator@example.com');
  await page.getByLabel('Password', { exact: true }).fill('LocalDemo123');
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inventory overview.' })).toBeVisible();
  await expect(page.locator('.warehouse-chip')).toContainText('Rack A');
  await nav(page, 'Products');
  await expect(page.getByRole('button', { name: 'Add product', exact: true })).toHaveCount(0);
  await nav(page, 'Receipts');
  await page.getByRole('button', { name: 'New receipt', exact: true }).click();
  await page.getByLabel(/Supplier/).fill('Registered operator supplier');
  await expect(page.getByLabel(/Destination warehouse/)).toBeDisabled();
  await page.getByLabel('Product on line 1').selectOption('prod-stl-001');
  await page.getByLabel('Quantity on line 1').fill('2');
  await page.getByRole('button', { name: 'Create receipt', exact: true }).click();
  const id = (await inventory(page)).receipts[0].id;
  await page
    .getByRole('row')
    .filter({ hasText: id })
    .getByRole('button', { name: /Validate/ })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Validate & receive' }).click();
  expect(
    (await inventory(page)).products.find((p) => p.id === 'prod-stl-001')!.locationStock['loc-rack-a'],
  ).toBe(2);
  await page.locator('.account-button').click();
  await page.getByLabel(/Full name/).fill('Renamed operator');
  await page.getByRole('button', { name: 'Save details' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Duplicate');
  await page.getByLabel('Email address', { exact: true }).fill('NEW-OPERATOR@example.com');
  await page.getByLabel('Password', { exact: true }).fill('OtherDemo123');
  await page.getByRole('button', { name: 'Create demo account' }).click();
  await expect(page.getByRole('alert')).toContainText('already uses this email');
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await page.getByLabel('Password', { exact: true }).fill('LocalDemo123');
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.locator('.account-button')).toContainText('Renamed operator');
  await page.reload();
  await expect(page.locator('.account-button')).toContainText('Renamed operator');
});

test('open documents can be canceled and filtered without moving stock', async ({ page }) => {
  await login(page);
  await nav(page, 'Receipts');
  await page.getByRole('row').filter({ hasText: 'REC-2026-004' }).click();
  await page.getByRole('combobox', { name: 'Receipt status', exact: true }).selectOption('Canceled');
  await page.getByTitle('Close (Esc)').click();
  await page.getByLabel('Receipt status filter').selectOption('Canceled');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  let state = await inventory(page);
  const products = state.products,
    ledger = state.ledger;
  await nav(page, 'Deliveries');
  await page.getByRole('row').filter({ hasText: 'DEL-2026-003' }).click();
  await page.getByRole('button', { name: 'Cancel delivery', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel delivery', exact: true }).click();
  await page.getByTitle('Close (Esc)').click();
  await page.getByLabel('Delivery status filter').selectOption('Canceled');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await nav(page, 'Transfers');
  await page
    .getByRole('row')
    .filter({ hasText: 'TRF-2026-002' })
    .getByRole('button', { name: 'Cancel transfer' })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel transfer' }).click();
  await page.getByRole('combobox', { name: 'Transfer status', exact: true }).selectOption('Canceled');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  state = await inventory(page);
  expect(state.products).toEqual(products);
  expect(state.ledger).toEqual(ledger);
  await nav(page, 'Overview');
  await page.getByRole('combobox', { name: 'Document status', exact: true }).selectOption('Canceled');
  await expect(page.locator('.queue-row')).toHaveCount(3);
  await metric(page, 'Open receipts', '00');
  await metric(page, 'Open deliveries', '00');
  await metric(page, 'Transfers scheduled', '00');
});

test('signup and OTP screens remain usable in both themes and on narrow screens', async ({ page }) => {
  await page.goto('/');
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();
    await page.screenshot({ path: '.test-artifacts/signup-' + theme + '.png', fullPage: true });
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await page.getByRole('button', { name: 'Need account access?' }).click();
    await page.screenshot({ path: '.test-artifacts/reset-' + theme + '.png', fullPage: true });
    await page.getByRole('button', { name: 'Back to sign in' }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: '.test-artifacts/signup-mobile.png', fullPage: true });
});

test('registered manager can prepare an order that assigned staff pick, pack and dispatch', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main navigation', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Registered manager');
  await page.getByRole('combobox', { name: 'Demo role', exact: true }).selectOption('Inventory Manager');
  await page.getByLabel('Email address', { exact: true }).fill('manager@example.com');
  await page.getByLabel('Password', { exact: true }).fill('ManagerDemo123');
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inventory overview.' })).toBeVisible();
  await nav(page, 'Settings');
  await expect(page.getByRole('button', { name: 'Add location', exact: true })).toBeVisible();
  await nav(page, 'Deliveries');
  await page.getByRole('button', { name: 'New delivery', exact: true }).click();
  await page.getByLabel(/Customer/).fill('Staff workflow customer');
  await page.getByLabel(/Origin warehouse/).selectOption('loc-prod');
  await page.getByLabel('Product on line 1').selectOption('prod-stl-001');
  await page.getByLabel('Quantity on line 1').fill('10');
  await page.getByRole('button', { name: 'Create delivery', exact: true }).click();
  const before = await inventory(page);
  const id = before.deliveries[0].id;
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
  await page.getByRole('button', { name: /Warehouse Staff/ }).click();
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await nav(page, 'Deliveries');
  await page.getByRole('row').filter({ hasText: id }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Pick items', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Pack items', exact: true }).click();
  expect((await inventory(page)).products).toEqual(before.products);
  await page.getByRole('dialog').getByRole('button', { name: 'Dispatch order', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /Dispatch/ })
    .click();
  const state = await inventory(page);
  expect(state.products.find((product) => product.id === 'prod-stl-001')!.locationStock['loc-prod']).toBe(40);
  expect(state.ledger[0]).toMatchObject({ referenceId: id, userId: 'USR-002', quantityChange: -10 });
  await page.reload();
  expect(await inventory(page)).toEqual(state);
});

test('failed account saves leave signup and OTP reset retryable without false success', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'stocksense_account_v1') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Save failure');
  await page.getByLabel('Email address', { exact: true }).fill('save-failure@example.com');
  await page.getByLabel('Password', { exact: true }).fill('FailureDemo123');
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save changes');
  expect(await page.evaluate(() => localStorage.getItem('stocksense_account_v1'))).toBeNull();
  await page.reload();
  await page.getByRole('button', { name: 'Need account access?' }).click();
  await page.getByLabel('Email address', { exact: true }).fill('manager@stocksense.demo');
  await page.getByRole('button', { name: 'Generate demo OTP' }).click();
  const code = await page.getByTestId('demo-otp').innerText();
  await page.getByLabel('One-time code', { exact: true }).fill(code);
  await page.getByLabel('New demo password', { exact: true }).fill('ChangedDemo123');
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    let failOnce = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'stocksense_account_v1' && failOnce) {
        failOnce = false;
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return write.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Change demo password' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save changes');
  const account = await page.evaluate(() => JSON.parse(localStorage.getItem('stocksense_account_v1')!));
  expect(account.credentials['USR-001']).toBeUndefined();
  expect(account.resets['USR-001']).toBeTruthy();
  await page.getByRole('button', { name: 'Change demo password' }).click();
  await expect(page.getByRole('button', { name: 'Open workspace' })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('ChangedDemo123');
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory overview.' })).toBeVisible();
});

test('count selection resets a draft physical count even when locations have equal balances', async ({
  page,
}) => {
  await login(page);
  await nav(page, 'Stock counts');
  await page.getByRole('button', { name: 'New adjustment', exact: true }).click();
  await page.getByRole('combobox', { name: 'Location *', exact: true }).selectOption('loc-rack-a');
  await expect(page.getByLabel('Physical count', { exact: true })).toHaveValue('0');
  await page.getByLabel('Physical count', { exact: true }).fill('9');
  await page.getByRole('combobox', { name: 'Location *', exact: true }).selectOption('loc-rack-b');
  await expect(page.getByLabel('Physical count', { exact: true })).toHaveValue('0');
});
