import { type Locator, type Page, expect } from '@playwright/test';

/** 登入頁 Page Object */
export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly registerLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: '登入 PickCourt' });
    this.emailInput = page.getByRole('textbox', { name: '電子郵件地址' });
    this.passwordInput = page.getByLabel('密碼');
    this.submitButton = page.getByRole('button', { name: '登入', exact: true });
    this.registerLink = page.getByRole('link', { name: '創建新帳戶' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeEnabled();
  }

  async fillCredentials(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillCredentials(email, password);
    await this.submit();
  }

  generalError(message: string): Locator {
    return this.page.getByText(message, { exact: true });
  }
}
