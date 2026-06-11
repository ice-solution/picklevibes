/** 恆常活動置頂狀態 */

function isEffectivelyPinned(activity, now = new Date()) {
  if (!activity?.isPinned) return false;
  if (activity.pinnedUntil && new Date(activity.pinnedUntil) <= now) return false;
  return true;
}

function formatRegularActivityResponse(activity, now = new Date()) {
  const doc = activity.toObject ? activity.toObject() : { ...activity };
  const effectivelyPinned = isEffectivelyPinned(doc, now);
  return {
    _id: doc._id,
    title: doc.title,
    description: doc.description,
    introduction: doc.introduction,
    poster: doc.poster,
    requirements: doc.requirements,
    fee: doc.fee != null ? doc.fee : 0,
    isActive: doc.isActive,
    isPinned: doc.isPinned,
    pinnedAt: doc.pinnedAt,
    pinnedUntil: doc.pinnedUntil,
    isEffectivelyPinned: effectivelyPinned,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy,
  };
}

function buildPinnedSortStages(now = new Date()) {
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
        _pinnedAtSort: { $ifNull: ['$pinnedAt', '$createdAt'] },
      },
    },
    { $sort: { _effectivelyPinned: -1, _pinnedAtSort: -1, createdAt: -1 } },
  ];
}

module.exports = {
  isEffectivelyPinned,
  formatRegularActivityResponse,
  buildPinnedSortStages,
};
