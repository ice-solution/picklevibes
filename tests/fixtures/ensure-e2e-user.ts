import type { APIRequestContext } from '@playwright/test';
import { e2eCredentials } from './credentials';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:5001/api';

/**
 * 透過運行中的 API 確保 E2E 測試帳號存在（於 webServer 啟動後呼叫）
 */
export async function ensureE2eUser(request: APIRequestContext): Promise<void> {
  const { validEmail, validPassword } = e2eCredentials;

  const loginRes = await request.post(`${API_BASE}/auth/login`, {
    data: { email: validEmail, password: validPassword },
  });
  if (loginRes.ok()) {
    return;
  }

  const registerRes = await request.post(`${API_BASE}/auth/register`, {
    data: {
      name: 'E2E 測試用戶',
      email: validEmail,
      password: validPassword,
      phone: '90000001',
    },
  });
  if (registerRes.ok()) {
    return;
  }

  const body = (await registerRes.json().catch(() => ({}))) as { message?: string };

  // 並行或重跑時可能已被其他 worker 建立，再試登入
  const loginRetry = await request.post(`${API_BASE}/auth/login`, {
    data: { email: validEmail, password: validPassword },
  });
  if (loginRetry.ok()) {
    return;
  }

  if (body.message?.includes('已被使用')) {
    throw new Error(
      `E2E 用戶 ${validEmail} 已存在但密碼不符。請執行：npm run test:e2e:setup`
    );
  }

  throw new Error(
    `無法建立 E2E 測試用戶（${registerRes.status()}）：${body.message ?? '請確認 API 已啟動'}`
  );
}
