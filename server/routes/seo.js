const express = require('express');
const Vlog = require('../models/Vlog');

const router = express.Router();

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getBaseUrl(req) {
  const env = process.env.CLIENT_URL || process.env.PUBLIC_URL || '';
  if (env && /^https?:\/\//i.test(env)) return env.replace(/\/+$/, '');
  const host = req.get('host');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${host}`;
}

// @route   GET /sitemap.xml
// @desc    Sitemap（包含已發布 vlog + 主要靜態頁）
// @access  Public
router.get('/sitemap.xml', async (req, res) => {
  try {
    const base = getBaseUrl(req);
    const staticUrls = [
      { loc: `${base}/`, changefreq: 'daily', priority: '1.0' },
      { loc: `${base}/about`, changefreq: 'monthly', priority: '0.7' },
      { loc: `${base}/faq`, changefreq: 'monthly', priority: '0.5' },
      { loc: `${base}/terms`, changefreq: 'yearly', priority: '0.2' },
      { loc: `${base}/privacy`, changefreq: 'yearly', priority: '0.2' },
      { loc: `${base}/activities`, changefreq: 'weekly', priority: '0.6' },
      { loc: `${base}/shop`, changefreq: 'weekly', priority: '0.6' },
    ];

    const vlogs = await Vlog.find({ isPublished: true })
      .select('_id updatedAt publishedAt')
      .sort({ publishedAt: -1, updatedAt: -1 })
      .lean();

    const vlogUrls = vlogs.map((v) => {
      const lastmod = (v.updatedAt || v.publishedAt || new Date()).toISOString();
      return {
        loc: `${base}/vlog/${v._id}`,
        lastmod,
        changefreq: 'weekly',
        priority: '0.6'
      };
    });

    const all = [...staticUrls, ...vlogUrls];
    const body = all.map((u) => {
      const lastmod = u.lastmod ? `<lastmod>${xmlEscape(u.lastmod)}</lastmod>` : '';
      const changefreq = u.changefreq ? `<changefreq>${xmlEscape(u.changefreq)}</changefreq>` : '';
      const priority = u.priority ? `<priority>${xmlEscape(u.priority)}</priority>` : '';
      return `<url><loc>${xmlEscape(u.loc)}</loc>${lastmod}${changefreq}${priority}</url>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (error) {
    console.error('產生 sitemap.xml 錯誤:', error);
    res.status(500).send('sitemap error');
  }
});

// @route   GET /robots.txt
// @desc    Robots
// @access  Public
router.get('/robots.txt', async (req, res) => {
  const base = getBaseUrl(req);
  const lines = [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${base}/sitemap.xml`
  ];
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(lines.join('\n'));
});

module.exports = router;

