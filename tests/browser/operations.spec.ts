import { test as base, expect, type Page } from '@playwright/test';
import type { InventorySnapshot } from '../../src/types';

const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors, 'Operations must not throw browser runtime errors').toEqual([]);
    },
    { auto: true },
  ],
});

// Optional real LAN origin for hands-on verification with the same UI steps.
if (process.env.STOCKSENSE_TEST_URL) test.use({ baseURL: process.env.STOCKSENSE_TEST_URL });

async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Inventory Manager/ }).click();
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory overview.' })).toBeVisible();
}

async function navigate(page: Page, label: string) {
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name: label, exact: true })
    .click();
}

async function saved(page: Page): Promise<InventorySnapshot> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('stocksense_inventory_v1')!));
}

async function reloadAndCheck(page: Page, expected: InventorySnapshot) {
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Inventory overview.' })).toBeVisible();
  expect(await saved(page)).toEqual(expected);
}

function stock(state: InventorySnapshot) {
  return state.products.find((product) => product.id === 'prod-stl-001')!;
}

for (const withoutRandomUUID of [false, true]) {
  test.describe(withoutRandomUUID ? 'without crypto.randomUUID' : 'default browser crypto', () => {
    test.beforeEach(async ({ page }) => {
      if (withoutRandomUUID) {
        // HTTP LAN origins expose getRandomValues, but not the secure-context-only randomUUID.
        await page.addInitScript(() => {
          Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
        });
      }
      await login(page);
      if (withoutRandomUUID) expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe('undefined');
    });

    test('create and receive stock, record one movement, and retain it after reload', async ({ page }) => {
      await navigate(page, 'Receipts');
      await page.getByRole('button', { name: 'New receipt', exact: true }).click();
      await page.getByLabel(/Supplier/).fill('Operations regression supplier');
      await page.getByLabel(/Destination warehouse/).selectOption('loc-main');
      await page.getByLabel('Product on line 1').selectOption('prod-stl-001');
      await page.getByLabel('Quantity on line 1').fill('12.5');
      await page.getByRole('button', { name: 'Create receipt', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      let state = await saved(page);
      const receiptId = state.receipts[0].id;
      const ledgerCount = state.ledger.length;
      expect(stock(state).stock).toBe(250);
      await page
        .getByRole('row')
        .filter({ hasText: receiptId })
        .getByRole('button', { name: /Validate/ })
        .click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Validate & receive' }).click();
      state = await saved(page);
      expect(stock(state).stock).toBe(262.5);
      expect(stock(state).locationStock['loc-main']).toBe(212.5);
      expect(state.receipts[0].status).toBe('Done');
      expect(state.ledger).toHaveLength(ledgerCount + 1);
      expect(state.ledger[0]).toMatchObject({
        referenceId: receiptId,
        operationType: 'Receipt',
        quantityChange: 12.5,
        toLocationId: 'loc-main',
        userId: 'USR-001',
      });
      await expect(
        page
          .getByRole('row')
          .filter({ hasText: receiptId })
          .getByRole('button', { name: /Validate/ }),
      ).toHaveCount(0);
      await reloadAndCheck(page, state);
      await navigate(page, 'Stock ledger');
      await expect(page.getByRole('row').filter({ hasText: receiptId })).toContainText('+12.5 kg');
    });

    test('create and dispatch a delivery while rejecting insufficient stock', async ({ page }) => {
      await navigate(page, 'Deliveries');
      await page.getByRole('button', { name: 'New delivery', exact: true }).click();
      await page.getByLabel(/Customer/).fill('Operations regression customer');
      await page.getByLabel(/Origin warehouse/).selectOption('loc-main');
      await page.getByLabel('Product on line 1').selectOption('prod-stl-001');
      await page.getByLabel('Quantity on line 1').fill('201');
      await page.getByRole('button', { name: 'Create delivery', exact: true }).click();
      await expect(page.getByRole('dialog')).toContainText('Insufficient stock');
      expect(await saved(page)).toBeNull();
      await page.getByLabel('Quantity on line 1').fill('7.5');
      await page.getByRole('button', { name: 'Create delivery', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      let state = await saved(page);
      const deliveryId = state.deliveries[0].id;
      const ledgerCount = state.ledger.length;
      expect(stock(state).stock).toBe(250);
      await page
        .getByRole('row')
        .filter({ hasText: deliveryId })
        .getByRole('button', { name: 'Pick items', exact: true })
        .click();
      await page
        .getByRole('row')
        .filter({ hasText: deliveryId })
        .getByRole('button', { name: 'Pack items', exact: true })
        .click();
      await page
        .getByRole('row')
        .filter({ hasText: deliveryId })
        .getByRole('button', { name: 'Dispatch order' })
        .click();
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /Dispatch/ })
        .click();
      state = await saved(page);
      expect(stock(state).stock).toBe(242.5);
      expect(stock(state).locationStock['loc-main']).toBe(192.5);
      expect(state.deliveries[0]).toMatchObject({ status: 'Done', stage: 'Validated' });
      expect(state.ledger).toHaveLength(ledgerCount + 1);
      expect(state.ledger[0]).toMatchObject({
        referenceId: deliveryId,
        operationType: 'Delivery',
        quantityChange: -7.5,
        fromLocationId: 'loc-main',
        userId: 'USR-001',
      });
      await reloadAndCheck(page, state);
      await navigate(page, 'Stock ledger');
      await expect(page.getByRole('row').filter({ hasText: deliveryId })).toContainText('-7.5 kg');
    });

    test('transfer uses current balances, preserves totals, and prevents repeat submission', async ({
      page,
    }) => {
      await navigate(page, 'Transfers');
      await page.getByLabel(/Select product/).selectOption('prod-stl-001');
      await page.getByLabel('From location').selectOption('loc-main');
      await page.getByLabel('To location').selectOption('loc-main');
      await page.getByLabel('Transfer quantity').fill('20');
      await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
      await expect(page.getByRole('main')).toContainText(
        'Source and destination locations cannot be the same',
      );
      expect(await saved(page)).toBeNull();
      await page.getByLabel('To location').selectOption('loc-prod');
      await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Transfer completed', exact: true })).toBeDisabled();
      let state = await saved(page);
      const transferId = state.transfers[0].id;
      expect(stock(state).locationStock).toMatchObject({ 'loc-main': 180, 'loc-prod': 70 });
      expect(stock(state).stock).toBe(250);
      expect(state.ledger.filter((entry) => entry.referenceId === transferId)).toHaveLength(1);
      expect(state.ledger[0]).toMatchObject({
        operationType: 'Transfer',
        quantityChange: 20,
        fromLocationId: 'loc-main',
        toLocationId: 'loc-prod',
        userId: 'USR-001',
      });
      await page.getByLabel('Transfer quantity').fill('181');
      await expect(page.getByRole('button', { name: 'Confirm transfer', exact: true })).toBeDisabled();
      expect(await saved(page)).toEqual(state);
      await page.getByLabel('Transfer quantity').fill('180');
      await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
      state = await saved(page);
      expect(stock(state).locationStock).toMatchObject({ 'loc-main': 0, 'loc-prod': 250 });
      expect(stock(state).stock).toBe(250);
      await reloadAndCheck(page, state);
      await navigate(page, 'Stock ledger');
      await expect(page.getByRole('row').filter({ hasText: transferId })).toContainText('20 kg moved');
    });

    test('physical count reconciles only its selected location and records the difference', async ({
      page,
    }) => {
      await navigate(page, 'Stock counts');
      await page.getByRole('button', { name: /New adjustment/ }).click();
      await page.getByLabel(/Select product/).selectOption('prod-stl-001');
      await page.getByLabel('Location *', { exact: true }).selectOption('loc-prod');
      await expect(page.getByLabel('Physical count', { exact: true })).toHaveValue('50');
      await page.getByLabel('Physical count', { exact: true }).fill('45.5');
      await page.getByRole('button', { name: 'Apply adjustment', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const state = await saved(page);
      const adjustmentId = state.adjustments[0].id;
      expect(stock(state).locationStock).toMatchObject({ 'loc-main': 200, 'loc-prod': 45.5 });
      expect(stock(state).stock).toBe(245.5);
      expect(state.adjustments[0]).toMatchObject({
        systemQuantity: 50,
        physicalCount: 45.5,
        difference: -4.5,
        locationId: 'loc-prod',
      });
      expect(state.ledger[0]).toMatchObject({
        referenceId: adjustmentId,
        operationType: 'Adjustment',
        quantityChange: -4.5,
        fromLocationId: 'loc-prod',
        userId: 'USR-001',
      });
      await reloadAndCheck(page, state);
      await navigate(page, 'Stock ledger');
      await expect(page.getByRole('row').filter({ hasText: adjustmentId })).toContainText('-4.5 kg');
    });
  });
}
