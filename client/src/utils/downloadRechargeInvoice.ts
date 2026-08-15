import axios from 'axios';

async function readAxiosErrorMessage(error: unknown): Promise<string> {
  const err = error as any;
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed?.message) return parsed.message;
    } catch {
      /* ignore */
    }
  }
  if (typeof data?.message === 'string') return data.message;
  if (typeof err?.message === 'string' && err.message !== 'Network Error') return err.message;
  return '下載發票失敗，請稍後再試';
}

/**
 * 依充值記錄即時下載發票 PDF（後端 on-demand generate，不存實體檔）
 */
export async function downloadRechargeInvoicePdf(rechargeId: string): Promise<void> {
  try {
    const res = await axios.get(`/recharge/${rechargeId}/invoice.pdf`, {
      responseType: 'blob',
    });

    const contentType = String(res.headers['content-type'] || '');
    if (contentType.includes('application/json')) {
      const text = await (res.data as Blob).text();
      let message = '無法下載發票';
      try {
        message = JSON.parse(text)?.message || message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    const disposition = String(res.headers['content-disposition'] || '');
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
    const filename = match
      ? decodeURIComponent(match[1].replace(/"/g, ''))
      : `發票_${rechargeId.slice(-8).toUpperCase()}.pdf`;

    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(await readAxiosErrorMessage(error));
  }
}
