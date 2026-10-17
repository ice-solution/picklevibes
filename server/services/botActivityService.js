const Activity = require('../models/Activity');
const { resolveStoreId } = require('./botStoreService');

function formatHkDateTime(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * 活動中心：即將開始／進行中嘅可報名活動（供 WhatsApp／LLM）
 */
async function listActivitiesForBot({ storeQuery, limit = 15 } = {}) {
  const now = new Date();
  const lim = Math.min(30, Math.max(1, Number(limit) || 15));

  const query = {
    isActive: true,
    status: { $in: ['upcoming', 'ongoing'] },
    endDate: { $gte: now },
  };

  let store = null;
  if (storeQuery) {
    store = await resolveStoreId(storeQuery);
    query.store = store.id;
  }

  const activities = await Activity.find(query)
    .populate('store', 'name slug address')
    .sort({ startDate: 1 })
    .limit(lim);

  const siteBase = String(process.env.PUBLIC_SITE_URL || 'https://picklevibes.hk').replace(/\/$/, '');

  const items = activities.map((a) => {
    const registered = Number(a.currentParticipants) || 0;
    const max = Number(a.maxParticipants) || 0;
    const availableSpots = Math.max(0, max - registered);
    const deadline = a.registrationDeadline ? new Date(a.registrationDeadline) : null;
    const registrationOpen = !deadline || deadline.getTime() >= now.getTime();
    const detailPath = `/activities/${a._id}`;

    return {
      id: String(a._id),
      title: a.title,
      description: String(a.description || '').slice(0, 200),
      category: a.category || null,
      status: a.status,
      location: a.location,
      store: a.store
        ? {
            id: String(a.store._id),
            name: a.store.name,
            slug: a.store.slug,
            address: a.store.address || '',
          }
        : null,
      startAt: formatHkDateTime(a.startDate),
      endAt: formatHkDateTime(a.endDate),
      registrationDeadline: formatHkDateTime(a.registrationDeadline),
      pricePoints: a.price,
      maxParticipants: max,
      currentParticipants: registered,
      availableSpots,
      registrationOpen,
      canRegister: registrationOpen && availableSpots > 0 && a.status !== 'cancelled',
      detailPath,
      detailUrl: `${siteBase}${detailPath}`,
    };
  });

  return {
    store,
    count: items.length,
    activities: items,
    activitiesHubUrl: `${siteBase}/activities`,
    note: 'WhatsApp 可列出活動；報名請用網站活動詳情頁完成。',
  };
}

module.exports = {
  listActivitiesForBot,
};
