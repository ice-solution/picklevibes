import { type Locator, type Page, expect } from '@playwright/test';

/** 球友登入後主頁（我的預約）Page Object */
export class MyBookingsPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: '我的預約' });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/my-bookings/, { timeout: 15_000 });
    await expect(this.heading).toBeVisible();
  }
}
