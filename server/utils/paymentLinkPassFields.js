/**
 * 正規化／驗證收款連結的月卡／Reclub 欄位。
 * @returns {{ error?: string, fields?: object }}
 */
function normalizePaymentLinkPassFields(body, { isValidHhMm, isValidYmd }) {
  const purpose =
    body.purpose === 'sell_pass' ? 'sell_pass' : 'activity';
  const isReclub = body.isReclub === true || body.isReclub === 'true' || body.isReclub === 1;
  let sessionDate = String(body.sessionDate || '').trim();
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
        sessionDate: '',
        sessionStart: '',
        sessionEnd: '',
      },
    };
  }

  passPlan = null;

  if (isReclub) {
    if (!sessionDate || !sessionStart || !sessionEnd) {
      return { error: 'Reclub 活動請填寫日期與時段（開始／結束）' };
    }
    if (!isValidYmd(sessionDate)) {
      return { error: '活動日期格式須為 YYYY-MM-DD' };
    }
    if (!isValidHhMm(sessionStart) || !isValidHhMm(sessionEnd)) {
      return { error: '時段格式須為 HH:mm（例 12:00）' };
    }
    const { parseHhMmToMinutes } = require('../services/monthlyPassService');
    if (parseHhMmToMinutes(sessionEnd) <= parseHhMmToMinutes(sessionStart)) {
      return { error: '結束時間必須晚於開始時間' };
    }
  } else if (sessionStart || sessionEnd || sessionDate) {
    if (!sessionDate || !sessionStart || !sessionEnd) {
      return { error: '請同時填寫活動日期、開始與結束時段，或全部留空' };
    }
    if (!isValidYmd(sessionDate)) {
      return { error: '活動日期格式須為 YYYY-MM-DD' };
    }
    if (!isValidHhMm(sessionStart) || !isValidHhMm(sessionEnd)) {
      return { error: '時段格式須為 HH:mm（例 12:00）' };
    }
    const { parseHhMmToMinutes } = require('../services/monthlyPassService');
    if (parseHhMmToMinutes(sessionEnd) <= parseHhMmToMinutes(sessionStart)) {
      return { error: '結束時間必須晚於開始時間' };
    }
  } else {
    sessionDate = '';
    sessionStart = '';
    sessionEnd = '';
  }

  return {
    fields: {
      purpose: 'activity',
      passPlan: null,
      isReclub,
      sessionDate,
      sessionStart,
      sessionEnd,
    },
  };
}

module.exports = { normalizePaymentLinkPassFields };
