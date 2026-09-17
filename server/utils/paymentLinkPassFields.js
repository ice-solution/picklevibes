/**
 * 正規化／驗證收款連結的月卡／Reclub 欄位。
 * @returns {{ error?: string, fields?: object }}
 */
function normalizePaymentLinkPassFields(body, { isValidHhMm }) {
  const purpose =
    body.purpose === 'sell_pass' ? 'sell_pass' : 'activity';
  const isReclub = body.isReclub === true || body.isReclub === 'true' || body.isReclub === 1;
  let sessionStart = String(body.sessionStart || '').trim();
  let sessionEnd = String(body.sessionEnd || '').trim();
  let passPlan = body.passPlan || body.passPlanId || null;

  if (purpose === 'sell_pass') {
    if (!passPlan) {
      return { error: '賣月卡連結請選擇月卡方案' };
    }
    // 賣卡連結唔需要 Reclub 時段
    return {
      fields: {
        purpose,
        passPlan,
        isReclub: false,
        sessionStart: '',
        sessionEnd: '',
      },
    };
  }

  passPlan = null;

  if (isReclub) {
    if (!sessionStart || !sessionEnd) {
      return { error: 'Reclub 活動請填寫時段（開始／結束）' };
    }
    if (!isValidHhMm(sessionStart) || !isValidHhMm(sessionEnd)) {
      return { error: '時段格式須為 HH:mm（例 12:00）' };
    }
    const { parseHhMmToMinutes } = require('../services/monthlyPassService');
    if (parseHhMmToMinutes(sessionEnd) <= parseHhMmToMinutes(sessionStart)) {
      return { error: '結束時間必須晚於開始時間' };
    }
  } else if (sessionStart || sessionEnd) {
    if (!sessionStart || !sessionEnd) {
      return { error: '請同時填寫開始與結束時段，或留空' };
    }
    if (!isValidHhMm(sessionStart) || !isValidHhMm(sessionEnd)) {
      return { error: '時段格式須為 HH:mm（例 12:00）' };
    }
    const { parseHhMmToMinutes } = require('../services/monthlyPassService');
    if (parseHhMmToMinutes(sessionEnd) <= parseHhMmToMinutes(sessionStart)) {
      return { error: '結束時間必須晚於開始時間' };
    }
  } else {
    sessionStart = '';
    sessionEnd = '';
  }

  return {
    fields: {
      purpose: 'activity',
      passPlan: null,
      isReclub,
      sessionStart,
      sessionEnd,
    },
  };
}

module.exports = { normalizePaymentLinkPassFields };
