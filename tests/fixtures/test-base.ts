import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { MyBookingsPage } from '../pages/my-bookings.page';

type AppFixtures = {
  loginPage: LoginPage;
  myBookingsPage: MyBookingsPage;
};

/**
 * 擴充 Playwright test，注入 Page Object 實例
 */
export const test = base.extend<AppFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  myBookingsPage: async ({ page }, use) => {
    await use(new MyBookingsPage(page));
  },
});

export { expect } from '@playwright/test';
