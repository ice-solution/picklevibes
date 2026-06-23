/**
 * E2E 測試帳號（由 tests/global-setup.ts → ensureE2eUser.js 建立）
 * 覆寫方式：export E2E_USER_EMAIL / E2E_USER_PASSWORD
 */
export const e2eCredentials = {
  validEmail: process.env.E2E_USER_EMAIL ?? 'e2e-test@pickcourt.hk',
  validPassword: process.env.E2E_USER_PASSWORD ?? 'E2eTestPassword1',
  invalidPassword: process.env.E2E_INVALID_PASSWORD ?? 'definitely-wrong-password',
} as const;

export const authMessages = {
  invalidLogin: '電子郵件或密碼錯誤',
} as const;
