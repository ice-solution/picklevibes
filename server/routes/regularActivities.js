const express = require('express');
const { body, validationResult } = require('express-validator');
const RegularActivity = require('../models/RegularActivity');
const { auth, adminAuth } = require('../middleware/auth');
const { activityUpload, processActivityImage, deleteFile } = require('../middleware/upload');
const {
  formatRegularActivityResponse,
  buildPinnedSortStages,
} = require('../utils/regularActivityPin');

const router = express.Router();

async function listRegularActivities({ query, page, limit }) {
  const now = new Date();
  const limitN = Math.max(1, parseInt(limit, 10) || 10);
  const pageN = Math.max(1, parseInt(page, 10) || 1);
  const skip = (pageN - 1) * limitN;

  const pipeline = [
    { $match: query },
    ...buildPinnedSortStages(now),
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: 'createdBy',
        pipeline: [{ $project: { name: 1, email: 1 } }],
      },
    },
    {
      $unwind: {
        path: '$createdBy',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limitN }],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await RegularActivity.aggregate(pipeline);
  const total = result?.total?.[0]?.count || 0;

  return {
    activities: (result?.data || []).map((row) => formatRegularActivityResponse(row, now)),
    totalPages: Math.ceil(total / limitN) || 1,
    currentPage: pageN,
    total,
  };
}

// @route   GET /api/regular-activities
// @desc    獲取恆常活動列表（有效置頂優先）
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const payload = await listRegularActivities({
      query: { isActive: true },
      page,
      limit,
    });
    res.json(payload);
  } catch (error) {
    console.error('獲取恆常活動列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/regular-activities/:id
// @desc    獲取單個恆常活動詳情
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const activity = await RegularActivity.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }
    
    res.json(formatRegularActivityResponse(activity));
  } catch (error) {
    console.error('獲取恆常活動詳情錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/regular-activities
// @desc    創建新恆常活動（僅管理員）
// @access  Private (Admin)
router.post('/', [
  auth,
  adminAuth,
  activityUpload.single('poster'),
  processActivityImage,
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('活動標題必須在1-100個字符之間'),
  body('description').trim().isLength({ min: 1, max: 1000 }).withMessage('活動描述必須在1-1000個字符之間'),
  body('introduction').trim().isLength({ min: 1, max: 2000 }).withMessage('活動介紹必須在1-2000個字符之間'),
  body('requirements').optional().trim().isLength({ max: 500 }).withMessage('活動要求不能超過500個字符'),
  body('fee').optional().isFloat({ min: 0 }).withMessage('收費不能為負數')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // 如果上傳了圖片但驗證失敗，刪除已上傳的圖片
      if (req.file) {
        await deleteFile(req.file.path);
      }
      if (req.activityImages) {
        await deleteFile(req.activityImages.fullPath);
        await deleteFile(req.activityImages.thumbPath);
      }
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const {
      title,
      description,
      introduction,
      requirements,
      fee
    } = req.body;

    // 使用上傳的圖片路徑
    const posterPath = req.activityImages
      ? `/uploads/activities/${req.activityImages.fullFilename}`
      : (req.file ? `/uploads/activities/${req.file.filename}` : null);

    const activity = new RegularActivity({
      title,
      description,
      introduction,
      poster: posterPath,
      requirements: requirements || '',
      fee: fee != null && fee !== '' ? parseFloat(fee) : 0,
      isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' || req.body.isActive === true : true,
      createdBy: req.user.id
    });

    await activity.save();

    res.status(201).json({
      message: '恆常活動創建成功',
      activity: formatRegularActivityResponse(activity),
    });
  } catch (error) {
    console.error('創建恆常活動錯誤:', error);
    // 如果上傳了圖片但創建失敗，刪除已上傳的圖片
    if (req.file) {
      await deleteFile(req.file.path);
    }
    if (req.activityImages) {
      await deleteFile(req.activityImages.fullPath);
      await deleteFile(req.activityImages.thumbPath);
    }
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   PUT /api/regular-activities/:id
// @desc    更新恆常活動（僅管理員）
// @access  Private (Admin)
router.put('/:id', [
  auth,
  adminAuth,
  activityUpload.single('poster'),
  processActivityImage,
  body('title').optional().trim().isLength({ min: 1, max: 100 }).withMessage('活動標題必須在1-100個字符之間'),
  body('description').optional().trim().isLength({ min: 1, max: 1000 }).withMessage('活動描述必須在1-1000個字符之間'),
  body('introduction').optional().trim().isLength({ min: 1, max: 2000 }).withMessage('活動介紹必須在1-2000個字符之間'),
  body('requirements').optional().trim().isLength({ max: 500 }).withMessage('活動要求不能超過500個字符'),
  body('fee').optional().isFloat({ min: 0 }).withMessage('收費不能為負數')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // 如果上傳了圖片但驗證失敗，刪除已上傳的圖片
      if (req.file) {
        await deleteFile(req.file.path);
      }
      if (req.activityImages) {
        await deleteFile(req.activityImages.fullPath);
        await deleteFile(req.activityImages.thumbPath);
      }
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const activity = await RegularActivity.findById(req.params.id);
    
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }

    const {
      title,
      description,
      introduction,
      requirements,
      fee
    } = req.body;

    // 更新字段
    if (title !== undefined) activity.title = title;
    if (description !== undefined) activity.description = description;
    if (introduction !== undefined) activity.introduction = introduction;
    if (requirements !== undefined) activity.requirements = requirements;
    if (fee !== undefined && fee !== '') activity.fee = parseFloat(fee);
    if (req.body.isActive !== undefined) {
      activity.isActive = req.body.isActive === 'true' || req.body.isActive === true;
    }

    // 如果上傳了新圖片，刪除舊圖片並更新
    if (req.file || req.activityImages) {
      if (activity.poster) {
        const oldFilePath = activity.poster.replace('/uploads/', '');
        try {
          await deleteFile(`uploads/${oldFilePath}`);
        } catch (error) {
          console.error('刪除舊圖片錯誤:', error);
        }
      }
      
      activity.poster = req.activityImages
        ? `/uploads/activities/${req.activityImages.fullFilename}`
        : (req.file ? `/uploads/activities/${req.file.filename}` : activity.poster);
    }

    await activity.save();

    res.json({
      message: '恆常活動更新成功',
      activity: formatRegularActivityResponse(activity),
    });
  } catch (error) {
    console.error('更新恆常活動錯誤:', error);
    // 如果上傳了圖片但更新失敗，刪除已上傳的圖片
    if (req.file) {
      await deleteFile(req.file.path);
    }
    if (req.activityImages) {
      await deleteFile(req.activityImages.fullPath);
      await deleteFile(req.activityImages.thumbPath);
    }
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   PATCH /api/regular-activities/:id/pin
// @desc    置頂／取消置頂恆常活動
// @access  Private (Admin)
router.patch('/:id/pin', [
  auth,
  adminAuth,
  body('pinned').isBoolean().withMessage('pinned 須為布林值'),
  body('pinnedUntil').optional({ nullable: true }).isISO8601().withMessage('pinnedUntil 須為有效日期'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const activity = await RegularActivity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }

    const { pinned, pinnedUntil } = req.body;

    if (pinned) {
      activity.isPinned = true;
      activity.pinnedAt = new Date();
      activity.pinnedUntil = pinnedUntil ? new Date(pinnedUntil) : null;
    } else {
      activity.isPinned = false;
      activity.pinnedAt = null;
      activity.pinnedUntil = null;
    }

    await activity.save();

    res.json({
      message: pinned ? '已置頂' : '已取消置頂',
      activity: formatRegularActivityResponse(activity),
    });
  } catch (error) {
    console.error('更新恆常活動置頂錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   DELETE /api/regular-activities/:id
// @desc    刪除恆常活動（僅管理員）
// @access  Private (Admin)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const activity = await RegularActivity.findById(req.params.id);
    
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }

    // 刪除圖片
    if (activity.poster) {
      const filePath = activity.poster.replace('/uploads/', '');
      try {
        await deleteFile(`uploads/${filePath}`);
      } catch (error) {
        console.error('刪除圖片錯誤:', error);
      }
    }

    await activity.deleteOne();

    res.json({ message: '恆常活動刪除成功' });
  } catch (error) {
    console.error('刪除恆常活動錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;

