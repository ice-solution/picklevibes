const express = require('express');
const path = require('path');
const fs = require('fs');
const { openApiAuth } = require('../middleware/openApiAuth');
const {
  resolveBookingDeepLink,
  listOpenApiStores,
} = require('../utils/bookingDeepLink');

const router = express.Router();

const openApiSpecPath = path.join(__dirname, '../openapi/booking-openapi.json');

/** OpenAPI 規格（公開） */
router.get('/openapi.json', (req, res) => {
  try {
    const spec = JSON.parse(fs.readFileSync(openApiSpecPath, 'utf8'));
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    if (host) {
      spec.servers = [{ url: `${proto}://${host}/api/open`, description: '目前環境' }];
    }
    res.json(spec);
  } catch (e) {
    console.error('讀取 OpenAPI 規格失敗:', e);
    res.status(500).json({ message: '無法載入 OpenAPI 規格' });
  }
});

/** Swagger UI（公開） */
router.get('/docs', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PickleVibes Booking Open API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api/open/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout'
    });
  </script>
</body>
</html>`);
});

router.use(openApiAuth);

/** GET /api/open/booking/stores */
router.get('/booking/stores', async (req, res) => {
  try {
    const includeCourts =
      req.query.includeCourts !== 'false' && req.query.includeCourts !== '0';
    const stores = await listOpenApiStores({
      includeCourts,
      authContext: req.openApiAuth,
    });
    res.json({ success: true, data: { stores } });
  } catch (error) {
    console.error('Open API list stores:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

async function handleResolve(req, res) {
  try {
    const includeSlots = req.query.includeSlots === 'true' || req.query.includeSlots === '1';
    const duration = parseInt(req.query.duration, 10) || 60;
    const audienceRole = String(req.query.audienceRole || 'user').trim().toLowerCase();
    const data = await resolveBookingDeepLink({
      storeSlug: req.params.storeSlug,
      courtSlug: req.params.courtSlug,
      date: req.params.date,
      includeSlots,
      durationMinutes: duration === 120 ? 120 : 60,
      audienceRole,
      requireOpenApi: true,
      authContext: req.openApiAuth,
    });
    res.json({ success: true, data });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('Open API booking resolve:', error);
    res.status(status).json({ message: error.message || '服務器錯誤' });
  }
}

router.get('/booking/:storeSlug/:courtSlug/:date', handleResolve);
router.get('/booking/:storeSlug/:courtSlug', handleResolve);
router.get('/booking/:storeSlug', handleResolve);

module.exports = router;
