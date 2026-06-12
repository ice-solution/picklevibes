/** 活動中心（Activity）置頂與列表排序 */

function isEffectivelyPinned(activity, now = new Date()) {
  if (activity?.isPinned !== true) return false;
  if (activity.pinnedUntil != null && new Date(activity.pinnedUntil) <= now) return false;
  return true;
}

/** aggregation 用：是否有效置頂（須明確 isPinned === true） */
function buildEffectivelyPinnedExpr(now = new Date()) {
  return {
    $cond: {
      if: {
        $and: [
          { $eq: ['$isPinned', true] },
          {
            $or: [
              { $eq: [{ $ifNull: ['$pinnedUntil', null] }, null] },
              { $gt: ['$pinnedUntil', now] },
            ],
          },
        ],
      },
      then: 1,
      else: 0,
    },
  };
}

/**
 * 活動列表排序：
 * 1. 有效置頂優先
 * 2. 開始時間愈接近今天愈前（|startDate − now| 最小）
 * 3. 未結束優先於已結束
 */
function buildActivityListSortStages(now = new Date()) {
  const nowMs = now.getTime();
  return [
    {
      $addFields: {
        _effectivelyPinned: buildEffectivelyPinnedExpr(now),
        _proximity: {
          $abs: { $subtract: [{ $toLong: '$startDate' }, nowMs] },
        },
        _ended: { $lt: ['$endDate', now] },
      },
    },
    {
      $sort: {
        _effectivelyPinned: -1,
        _proximity: 1,
        _ended: 1,
        startDate: 1,
      },
    },
  ];
}

function withActivityPinFields(activity, now = new Date()) {
  const doc = activity.toObject ? activity.toObject() : { ...activity };
  return {
    ...doc,
    isEffectivelyPinned: isEffectivelyPinned(doc, now),
  };
}

module.exports = {
  isEffectivelyPinned,
  buildActivityListSortStages,
  withActivityPinFields,
};
