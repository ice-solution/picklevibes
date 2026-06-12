/** 活動中心（Activity）置頂與列表排序 */

function isEffectivelyPinned(activity, now = new Date()) {
  if (!activity?.isPinned) return false;
  if (activity.pinnedUntil && new Date(activity.pinnedUntil) <= now) return false;
  return true;
}

/**
 * 活動列表排序：
 * 1. 有效置頂優先
 * 2. 未結束優先於已結束
 * 3. 開始時間愈接近今天愈前（與原活動中心邏輯一致）
 */
function buildActivityListSortStages(now = new Date()) {
  return [
    {
      $addFields: {
        _effectivelyPinned: {
          $cond: {
            if: {
              $and: [
                '$isPinned',
                {
                  $or: [
                    { $eq: ['$pinnedUntil', null] },
                    { $gt: ['$pinnedUntil', now] },
                  ],
                },
              ],
            },
            then: 1,
            else: 0,
          },
        },
        _ended: { $lt: ['$endDate', now] },
        _sortKey: {
          $cond: [
            { $lt: ['$endDate', now] },
            { $multiply: [-1, { $toLong: '$startDate' }] },
            { $toLong: '$startDate' },
          ],
        },
      },
    },
    { $sort: { _effectivelyPinned: -1, _ended: 1, _sortKey: 1 } },
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
