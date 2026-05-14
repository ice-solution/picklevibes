const fs = require('fs');
const path = require('path');

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isSafeHttpUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  return /^https?:\/\//i.test(u) && !/^https?:\/\/\s*$/i.test(u);
}

/**
 * 將純文字粗略轉成可放進 email 的段落（不含信任 HTML）
 */
function plainTextToEmailHtml(text) {
  const t = String(text || '').trim();
  if (!t) return '<p style="margin:0 0 12px;color:#334155;">（無內文）</p>';
  return t
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 12px;color:#334155;">${escapeHtml(para).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRecipients(input) {
  if (!input) return [];
  const raw = Array.isArray(input) ? input.join('\n') : String(input);
  const parts = raw.split(/[\s,;]+/);
  const seen = new Set();
  const out = [];
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const p of parts) {
    const e = p.trim().toLowerCase();
    if (!e || !re.test(e) || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

function buildCtaSection(ctaUrl, ctaLabel) {
  if (!isSafeHttpUrl(ctaUrl) || !String(ctaLabel || '').trim()) return '';
  const href = escapeHtml(ctaUrl.trim());
  const label = escapeHtml(ctaLabel.trim());
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td align="center" style="padding:4px 0 8px;">
      <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#ec4899 0%,#14b8a6 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:9999px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`.trim();
}

/**
 * 讀取預設 EDM HTML 範本並填入變數。
 * @param {object} opts
 * @param {string} opts.headline - 標題（會 escape）
 * @param {string} opts.preheader - 預覽摘要（會 escape）
 * @param {string} opts.bodyHtml - 正文 HTML（不 escape，須由管理端控制來源）
 * @param {string} [opts.ctaUrl]
 * @param {string} [opts.ctaLabel]
 * @param {string} [opts.footerNote]
 * @param {string} [opts.siteUrl]
 * @param {string} [opts.siteName]
 */
function buildEdmHtml(opts = {}) {
  const templatePath = path.join(__dirname, '../templates/edm/default.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  const headline = opts.headline || 'PickleVibes 通知';
  const preheader = opts.preheader || headline;
  const bodyHtml = opts.bodyHtml != null ? String(opts.bodyHtml) : '';
  const footerNote = opts.footerNote || '感謝你支持 PickleVibes。';
  const siteUrl = isSafeHttpUrl(opts.siteUrl) ? opts.siteUrl.trim() : 'https://picklevibes.hk';
  const siteUrlText = escapeHtml(opts.siteName || '前往網站');
  const year = new Date().getFullYear();
  const ctaSection = buildCtaSection(opts.ctaUrl, opts.ctaLabel);

  return html
    .replace(/\{\{HEADLINE\}\}/g, escapeHtml(headline))
    .replace(/\{\{PREHEADER\}\}/g, escapeHtml(preheader))
    .replace(/\{\{BODY_HTML\}\}/g, bodyHtml)
    .replace(/\{\{CTA_SECTION\}\}/g, ctaSection)
    .replace(/\{\{FOOTER_NOTE\}\}/g, escapeHtml(footerNote))
    .replace(/\{\{SITE_URL\}\}/g, escapeHtml(siteUrl))
    .replace(/\{\{SITE_URL_TEXT\}\}/g, siteUrlText)
    .replace(/\{\{YEAR\}\}/g, String(year));
}

module.exports = {
  escapeHtml,
  buildEdmHtml,
  normalizeRecipients,
  stripHtml,
  plainTextToEmailHtml,
  isSafeHttpUrl
};
