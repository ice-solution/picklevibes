/**
 * Wonder Payment Gateway（與 checkinSystem 相同做法）
 * .env: PAYMENT_DEV=true → gateway-stg，否則 gateway 正式環境
 * 必填: WONDER_APP_ID, WONDER_PRIVATE_KEY
 */

const axios = require('axios');
const WonderSignature = require('../utils/wonderSignature');

process.env.TZ = 'UTC';

const WONDER_ECHO_URI = '/svc/payment/api/v1/openapi/echo';
const WONDER_ORDER_API_PATH = '/svc/payment/api/v1/openapi/orders';

function getPaymentBaseUrl() {
  const dev = (process.env.PAYMENT_DEV || process.env.payment_dev || '').toString().trim().toLowerCase();
  const isDev = dev === 'true' || dev === '1';
  return isDev ? 'https://gateway-stg.wonder.today' : 'https://gateway.wonder.today';
}

function formatTimeToYYYYMMDDHHMMSS(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function getWonderConfig() {
  const appId = (process.env.WONDER_APP_ID || '').trim();
  const customerUuid = (process.env.WONDER_CUSTOMER_UUID || '').trim();
  const apiKey = (process.env.WONDER_API_KEY || '').trim();
  const privateKeyRaw = process.env.WONDER_PRIVATE_KEY || '';
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n').trim();
  return { appId, customerUuid, apiKey, privateKey };
}

function getWonderAuthHeaders(privateKey, appId, method, uri, bodyString, credentialTime) {
  if (!privateKey || !appId) {
    throw new Error('WONDER_PRIVATE_KEY and WONDER_APP_ID are required for Wonder authentication');
  }
  const wonderSignature = new WonderSignature();
  const nonce = WonderSignature.generateRandomString(16);
  const now = credentialTime || formatTimeToYYYYMMDDHHMMSS();
  const credential = `${appId}/${now}/Wonder-RSA-SHA256`;
  const signature = wonderSignature.signature(privateKey, credential, nonce, method, uri, bodyString || null);
  return {
    Credential: credential,
    Nonce: nonce,
    Signature: signature,
  };
}

async function wonderAuthenticate() {
  const baseUrl = getPaymentBaseUrl();
  const { appId, privateKey } = getWonderConfig();
  if (!appId || !privateKey || !privateKey.includes('BEGIN')) {
    throw new Error('WONDER_APP_ID and WONDER_PRIVATE_KEY are required for Wonder auth');
  }

  const now = formatTimeToYYYYMMDDHHMMSS();
  const authBody = { message: `Hello, Current timestamp is ${now}` };
  const authBodyString = JSON.stringify(authBody);
  const method = 'POST';
  const authHeaders = getWonderAuthHeaders(privateKey, appId, method, WONDER_ECHO_URI, authBodyString, now);
  const url = `${baseUrl}${WONDER_ECHO_URI}`;
  const headers = {
    'Content-Type': 'application/json',
    Credential: authHeaders.Credential,
    Nonce: authHeaders.Nonce,
    Signature: authHeaders.Signature,
  };

  const response = await axios.post(url, authBodyString, {
    headers,
    timeout: 15000,
    validateStatus: () => true,
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Wonder auth failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }
}

/**
 * 建立 Wonder Payment Link 訂單
 * @returns {{ paymentUrl: string, orderId: string }}
 */
async function createOrder(params) {
  const baseUrl = getPaymentBaseUrl();
  const { appId, customerUuid, apiKey, privateKey } = getWonderConfig();
  if (!appId) {
    throw new Error('WONDER_APP_ID is required in .env');
  }

  await wonderAuthenticate();

  const amountStr =
    typeof params.amount === 'number' ? params.amount.toFixed(2) : String(params.amount || '0.00');

  const body = {
    app_id: appId,
    order: {
      reference_number: String(params.referenceNumber || ''),
      charge_fee: amountStr,
      currency: (params.currency || 'HKD').toUpperCase(),
      note: String(params.note || '').slice(0, 255),
      callback_url: params.callbackUrl,
      redirect_url: params.redirectUrl,
    },
  };
  if (customerUuid) {
    body.customer_uuid = customerUuid;
  }

  const plainText = JSON.stringify(body);
  const query = 'with_payment_link=true';
  const uriWithQuery = `${WONDER_ORDER_API_PATH}?${query}`;
  const url = `${baseUrl}${uriWithQuery}`;
  const method = 'POST';

  if (!privateKey || !privateKey.includes('BEGIN')) {
    throw new Error('WONDER_PRIVATE_KEY is required for create order signature');
  }

  const orderAuthHeaders = getWonderAuthHeaders(privateKey, appId, method, uriWithQuery, plainText);
  const headers = {
    'Content-Type': 'application/json',
    Credential: orderAuthHeaders.Credential,
    Nonce: orderAuthHeaders.Nonce,
    Signature: orderAuthHeaders.Signature,
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }

  const response = await axios.post(url, plainText, {
    headers,
    timeout: 15000,
    validateStatus: () => true,
  });

  if (response.status !== 200 && response.status !== 201) {
    const msg =
      response.data?.message || response.data?.error || response.statusText || JSON.stringify(response.data);
    throw new Error(`Wonder create order failed: ${response.status} - ${JSON.stringify(msg)}`);
  }

  const data = response.data || {};
  const paymentUrl =
    data.payment_url ||
    data.url ||
    data.payment_link ||
    data.data?.payment_url ||
    data.data?.url ||
    data.data?.payment_link;
  const orderId =
    data.order_id ||
    data.id ||
    data.data?.order_id ||
    data.data?.id ||
    data.reference_number;

  if (!paymentUrl) {
    throw new Error(`Wonder API did not return payment_url. Response: ${JSON.stringify(data)}`);
  }

  return {
    paymentUrl,
    orderId: orderId || params.referenceNumber,
  };
}

async function echoTest() {
  await wonderAuthenticate();
  return { success: true, gateway: getPaymentBaseUrl() };
}

function isOrderPaid(body) {
  if (!body) return false;
  const state = String(body.state || body.order?.state || '').toLowerCase();
  const correspondenceState = String(
    body.correspondence_state || body.order?.correspondence_state || ''
  ).toLowerCase();
  return state === 'completed' || correspondenceState === 'paid';
}

module.exports = {
  getPaymentBaseUrl,
  getWonderConfig,
  wonderAuthenticate,
  createOrder,
  echoTest,
  isOrderPaid,
};
