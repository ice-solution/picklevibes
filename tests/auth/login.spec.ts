import { test, expect } from '../fixtures/test-base';
import { authMessages, e2eCredentials } from '../fixtures/credentials';
import { ensureE2eUser } from '../fixtures/ensure-e2e-user';

test.describe.configure({ mode: 'serial' });

test.describe('登入流程', () => {
  test.beforeAll(async ({ request }) => {
    await ensureE2eUser(request);
  });

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('錯誤帳密應顯示錯誤提示', async ({ loginPage, page }) => {
    await loginPage.login(e2eCredentials.validEmail, e2eCredentials.invalidPassword);

    await expect(loginPage.generalError(authMessages.invalidLogin)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('成功登入後跳轉至我的預約主頁', async ({ loginPage, myBookingsPage, page }) => {
    await loginPage.login(e2eCredentials.validEmail, e2eCredentials.validPassword);

    await myBookingsPage.expectLoaded();

    // 登入狀態：localStorage 應存有 JWT
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });
});
