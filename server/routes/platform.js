const express = require('express');
const Store = require('../models/Store');
const { auth } = require('../middleware/auth');
const { resolveMembership, formatMembershipForClient } = require('../utils/platformMembershipService');
const Court = require('../models/Court');
const GameHall = require('../models/GameHall');
const { resolveTenant } = require('../middleware/resolveTenant');
const { getRequestHost } = require('../utils/tenantResolver');
const { searchAllianceCourtAvailability } = require('../utils/allianceCourtSearch');
const Activity = require('../models/Activity');
const ActivityRegistration = require('../models/ActivityRegistration');
const {
  buildActivityListSortStages,
  withActivityPinFields,
} = require('../utils/activityPin');
const { typeCountsForCourts, effectiveCourtSlug } = require('../utils/courtSlug');

const router = express.Router();

const allianceStoreSelect =
  'name slug address district phone sortOrder allianceEnabled adminDomain consumerDomain subscriptionPlan branding';

function serializeAllianceStore(store) {
  const b = store.branding || {};
  return {
    id: store._id,
    name: b.displayName || store.name,
    slug: store.slug,
    address: store.address,
    district: store.district || null,
    phone: store.phone,
    logoUrl: b.logoUrl || null,
    tagline: b.tagline || null,
    intro: b.intro || null,
    primaryColor: b.primaryColor || null,
    subscriptionPlan: store.subscriptionPlan || 'starter',
  };
}

/** GET /api/platform/alliance/stores — PickCourt 聯盟場地列表 */
router.get('/alliance/stores', async (req, res) => {
  try {
    const stores = await Store.find({
      isActive: true,
      allianceEnabled: true,
    })
      .sort({ sortOrder: 1, name: 1 })
      .select(allianceStoreSelect)
      .lean();

    const storeIds = stores.map((s) => s._id);
    const courtCounts = storeIds.length
      ? await Court.aggregate([
          { $match: { store: { $in: storeIds }, isActive: true, type: { $ne: 'full_venue' } } },
          { $group: { _id: '$store', count: { $sum: 1 } } },
        ])
      : [];
    const countMap = Object.fromEntries(courtCounts.map((c) => [String(c._id), c.count]));

    res.json({
      stores: stores.map((s) => ({
        ...serializeAllianceStore(s),
        courtCount: countMap[String(s._id)] || 0,
      })),
    });
  } catch (error) {
    console.error('聯盟場地列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

/** GET /api/platform/tenant/resolve — 依 hostname / query 解析 tenant（僅加盟店鋪） */
router.get('/tenant/resolve', resolveTenant({ saasOnly: true }), async (req, res) => {
  try {
    const host = getRequestHost(req);

    if (!req.tenant) {
      return res.json({
        resolved: false,
        host,
        tenant: null,
      });
    }

    const t = req.tenant;
    const adminDomain = t.adminDomain ? String(t.adminDomain).toLowerCase() : null;
    const consumerDomain = t.consumerDomain ? String(t.consumerDomain).toLowerCase() : null;

    res.json({
      resolved: true,
      host,
      source: req.tenantSource,
      isAdminHost: Boolean(adminDomain && host === adminDomain),
      isConsumerHost: Boolean(consumerDomain && host === consumerDomain),
      tenant: {
        id: t._id,
        name: t.name,
        slug: t.slug,
        allianceEnabled: Boolean(t.allianceEnabled),
        adminDomain: t.adminDomain || null,
        consumerDomain: t.consumerDomain || null,
        subscriptionPlan: t.subscriptionPlan || 'starter',
        branding: t.branding || {},
      },
    });
  } catch (error) {
    console.error('tenant resolve 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

/** GET /api/platform/stores/:storeSlug — 聯盟店鋪公開資料（介紹頁） */
router.get('/stores/:storeSlug', async (req, res) => {
  try {
    const slug = String(req.params.storeSlug || '').trim().toLowerCase();
    const store = await Store.findOne({
      slug,
      isActive: true,
      allianceEnabled: true,
    })
      .select(allianceStoreSelect)
      .lean();
    if (!store) {
      return res.status(404).json({ message: '店鋪不存在或未加入聯盟' });
    }

    const courts = await Court.find({
      store: store._id,
      isActive: true,
      type: { $ne: 'full_venue' },
    })
      .sort({ number: 1 })
      .select('name slug number type capacity description')
      .lean();

    const courtTypeCounts = typeCountsForCourts(courts);

    const gameHalls = await GameHall.find({ store: store._id, isActive: true })
      .sort({ name: 1 })
      .select('name description seasonKey')
      .lean();

    const b = store.branding || {};
    res.json({
      store: {
        ...serializeAllianceStore(store),
        intro: b.intro || '',
        courtCount: courts.length,
        courts: courts.map((c) => ({
          id: String(c._id),
          name: c.name,
          slug: effectiveCourtSlug(c, courtTypeCounts),
          number: c.number,
          type: c.type,
          capacity: c.capacity,
          description: c.description || '',
        })),
        gameHalls: gameHalls.map((h) => ({
          id: String(h._id),
          name: h.name,
          description: h.description || '',
          seasonKey: h.seasonKey || 'season-1',
        })),
      },
    });
  } catch (error) {
    console.error('聯盟店鋪公開資料錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

/** GET /api/platform/stores/:storeSlug/game-halls — 聯盟店鋪的計分廳 */
router.get('/stores/:storeSlug/game-halls', async (req, res) => {
  try {
    const slug = String(req.params.storeSlug || '').trim().toLowerCase();
    const store = await Store.findOne({
      slug,
      isActive: true,
      allianceEnabled: true,
    })
      .select('name slug district branding')
      .lean();
    if (!store) {
      return res.status(404).json({ message: '聯盟店鋪不存在' });
    }

    const halls = await GameHall.find({ store: store._id, isActive: true })
      .sort({ name: 1 })
      .select('name description seasonKey store')
      .lean();

    res.json({
      store: {
        id: store._id,
        name: store.branding?.displayName || store.name,
        slug: store.slug,
        district: store.district || null,
      },
      gameHalls: halls.map((h) => ({
        id: h._id,
        name: h.name,
        description: h.description || '',
        seasonKey: h.seasonKey || 'season-1',
      })),
    });
  } catch (error) {
    console.error('聯盟 GameHall 列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

/** GET /api/platform/search/courts — 跨店搜尋空缺場地 */
router.get('/search/courts', async (req, res) => {
  try {
    const { district = '', region = '', date, startTime, duration = '60', courtType = '' } = req.query;
    if (!date || !startTime) {
      return res.status(400).json({ message: '請提供 date 與 startTime' });
    }
    const data = await searchAllianceCourtAvailability({
      district: district || region,
      date,
      startTime,
      duration,
      courtType,
    });
    res.json(data);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        message: error.message,
        code: error.code,
      });
    }
    console.error('聯盟場地搜尋錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

/** GET /api/platform/alliance/activities — 聯盟各店活動／課堂（依日期接近今天排序） */
router.get('/alliance/activities', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;
    const now = new Date();

    const allianceStores = await Store.find({
      isActive: true,
      allianceEnabled: true,
    })
      .select('_id name slug district branding')
      .lean();
    const storeIds = allianceStores.map((s) => s._id);
    if (storeIds.length === 0) {
      return res.json({ activities: [], total: 0, totalPages: 0, currentPage: page });
    }

    const storeMap = new Map(
      allianceStores.map((s) => [
        String(s._id),
        {
          id: String(s._id),
          name: s.branding?.displayName || s.name,
          slug: s.slug,
          logoUrl: s.branding?.logoUrl || null,
          district: s.district || null,
        },
      ])
    );

    const query = { isActive: true, store: { $in: storeIds } };
    const sortPipeline = buildActivityListSortStages(now);

    const idRows = await Activity.aggregate([
      { $match: query },
      ...sortPipeline,
      { $skip: skip },
      { $limit: limit },
      { $project: { _id: 1 } },
    ]);
    const orderedIds = idRows.map((r) => r._id);

    let activities = [];
    if (orderedIds.length > 0) {
      const found = await Activity.find({ _id: { $in: orderedIds } })
        .populate('store', 'name slug branding district')
        .lean();
      const byId = new Map(found.map((a) => [String(a._id), a]));
      activities = orderedIds.map((id) => byId.get(String(id))).filter(Boolean);
    }

    const total = await Activity.countDocuments(query);

    const registrations = await ActivityRegistration.aggregate([
      { $match: { activity: { $in: orderedIds }, status: 'registered' } },
      { $group: { _id: '$activity', total: { $sum: '$participantCount' } } },
    ]);
    const regMap = Object.fromEntries(registrations.map((r) => [String(r._id), r.total]));

    res.json({
      activities: activities.map((activity) => {
        const storeDoc = activity.store;
        const storeId = storeDoc?._id ? String(storeDoc._id) : null;
        const storeInfo = storeId
          ? storeMap.get(storeId) || {
              id: storeId,
              name: storeDoc.branding?.displayName || storeDoc.name,
              slug: storeDoc.slug,
              logoUrl: storeDoc.branding?.logoUrl || null,
              district: storeDoc.district || null,
            }
          : null;
        const totalRegistered = regMap[String(activity._id)] || 0;
        const pinned = withActivityPinFields(activity, now);
        return {
          id: String(activity._id),
          title: activity.title,
          description: activity.description,
          poster: activity.poster || null,
          posterThumb: activity.posterThumb || null,
          startDate: activity.startDate,
          endDate: activity.endDate,
          registrationDeadline: activity.registrationDeadline,
          location: activity.location,
          price: activity.price,
          maxParticipants: activity.maxParticipants,
          status: activity.status,
          totalRegistered,
          availableSpots: Math.max(0, activity.maxParticipants - totalRegistered),
          isEffectivelyPinned: pinned.isEffectivelyPinned,
          store: storeInfo,
        };
      }),
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error('聯盟活動列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

/** GET /api/platform/health */
router.get('/health', (req, res) => {
  res.json({ status: 'OK', platform: 'pickcourt', version: '0.1.0' });
});

/** GET /api/platform/membership/me — 當前用戶聯盟會籍 */
router.get('/membership/me', auth, async (req, res) => {
  try {
    const membership = await resolveMembership(req.user);
    res.json(formatMembershipForClient(membership));
  } catch (error) {
    console.error('讀取聯盟會籍錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
