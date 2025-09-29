const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// 內容管理相關的數據模型（這裡簡化為內存存儲，實際項目中應使用數據庫）
let contentData = {
  about: {
    title: '關於 PickleVibes',
    description: '我們是香港領先的匹克球場地，提供優質的運動體驗和社區環境。',
    mission: '讓每個人都能享受匹克球的樂趣，建立健康的運動社區。',
    vision: '成為香港最受歡迎的匹克球運動中心。',
    values: ['專業', '友善', '創新', '社區'],
    team: [
      {
        name: '教練團隊',
        description: '我們擁有經驗豐富的專業教練團隊',
        members: []
      }
    ]
  },
  facilities: {
    title: '我們的設施',
    description: '現代化的設施，為您提供最佳的運動體驗',
    features: [
      {
        title: '3個室內場地',
        description: '配備空調的室內場地，不受天氣影響',
        icon: 'court'
      },
      {
        title: '2個練習場',
        description: '專門用於練習和熱身的場地',
        icon: 'practice'
      },
      {
        title: '更衣室和淋浴',
        description: '舒適的更衣室和現代化淋浴設施',
        icon: 'shower'
      },
      {
        title: '商店',
        description: '提供專業匹克球裝備和紀念品',
        icon: 'shop'
      }
    ]
  },
  pricing: {
    title: '價格表',
    description: '透明的價格，無隱藏費用',
    plans: [
      {
        name: '基本會員',
        price: 0,
        features: ['場地預約', '基本設施使用'],
        popular: false
      },
      {
        name: '高級會員',
        price: 200,
        features: ['場地預約', '所有設施使用', '會員折扣', '優先預約'],
        popular: true
      },
      {
        name: 'VIP會員',
        price: 500,
        features: ['場地預約', '所有設施使用', '最大折扣', '專屬時段', '個人教練'],
        popular: false
      }
    ],
    courtRates: {
      peakHour: 150,
      offPeak: 100,
      memberDiscount: 20
    }
  },
  events: {
    title: '活動和比賽',
    description: '定期舉辦的活動和比賽，豐富您的運動體驗',
    upcoming: [],
    past: []
  },
  contact: {
    title: '聯繫我們',
    description: '有任何問題或建議，歡迎聯繫我們',
    phone: '+852 6368 1655',
    email: 'info@picklevibes.com',
    address: 'Shop 338, 3/F, Hopewell Mall, 15 Kennedy Road, Hong Kong',
    hours: '7am – 11pm Everyday',
    social: {
      facebook: 'https://facebook.com/picklevibes',
      instagram: 'https://instagram.com/picklevibes',
      linkedin: 'https://linkedin.com/company/picklevibes'
    }
  }
};

// @route   GET /api/content
// @desc    獲取所有內容
// @access  Public
router.get('/', (req, res) => {
  res.json({ content: contentData });
});

// @route   GET /api/content/:section
// @desc    獲取特定內容區塊
// @access  Public
router.get('/:section', (req, res) => {
  const { section } = req.params;
  
  if (!contentData[section]) {
    return res.status(404).json({ message: '內容區塊不存在' });
  }
  
  res.json({ content: contentData[section] });
});

// @route   PUT /api/content/:section
// @desc    更新內容區塊（管理員）
// @access  Private (Admin)
router.put('/:section', [
  auth,
  adminAuth,
  body('content').isObject().withMessage('內容必須是對象格式')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { section } = req.params;
    const { content } = req.body;

    if (!contentData[section]) {
      return res.status(404).json({ message: '內容區塊不存在' });
    }

    contentData[section] = { ...contentData[section], ...content };

    res.json({
      message: '內容更新成功',
      content: contentData[section]
    });
  } catch (error) {
    console.error('更新內容錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/content/events
// @desc    添加新活動（管理員）
// @access  Private (Admin)
router.post('/events', [
  auth,
  adminAuth,
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('活動標題必須在1-100個字符之間'),
  body('description').trim().isLength({ min: 1, max: 500 }).withMessage('活動描述必須在1-500個字符之間'),
  body('date').isISO8601().withMessage('請提供有效的日期格式'),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('請提供有效的開始時間'),
  body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('請提供有效的結束時間'),
  body('maxParticipants').isInt({ min: 1 }).withMessage('最大參與人數必須是正整數'),
  body('price').isFloat({ min: 0 }).withMessage('價格不能為負數')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const event = {
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date(),
      participants: []
    };

    contentData.events.upcoming.push(event);

    res.status(201).json({
      message: '活動創建成功',
      event
    });
  } catch (error) {
    console.error('創建活動錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/content/events/:id
// @desc    更新活動（管理員）
// @access  Private (Admin)
router.put('/events/:id', [
  auth,
  adminAuth,
  body('title').optional().trim().isLength({ min: 1, max: 100 }).withMessage('活動標題必須在1-100個字符之間'),
  body('description').optional().trim().isLength({ min: 1, max: 500 }).withMessage('活動描述必須在1-500個字符之間'),
  body('date').optional().isISO8601().withMessage('請提供有效的日期格式'),
  body('maxParticipants').optional().isInt({ min: 1 }).withMessage('最大參與人數必須是正整數'),
  body('price').optional().isFloat({ min: 0 }).withMessage('價格不能為負數')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const eventIndex = contentData.events.upcoming.findIndex(event => event.id === id);
    
    if (eventIndex === -1) {
      return res.status(404).json({ message: '活動不存在' });
    }

    contentData.events.upcoming[eventIndex] = {
      ...contentData.events.upcoming[eventIndex],
      ...req.body,
      updatedAt: new Date()
    };

    res.json({
      message: '活動更新成功',
      event: contentData.events.upcoming[eventIndex]
    });
  } catch (error) {
    console.error('更新活動錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/content/events/:id
// @desc    刪除活動（管理員）
// @access  Private (Admin)
router.delete('/events/:id', [auth, adminAuth], (req, res) => {
  try {
    const { id } = req.params;
    const eventIndex = contentData.events.upcoming.findIndex(event => event.id === id);
    
    if (eventIndex === -1) {
      return res.status(404).json({ message: '活動不存在' });
    }

    const deletedEvent = contentData.events.upcoming.splice(eventIndex, 1)[0];

    res.json({
      message: '活動刪除成功',
      event: deletedEvent
    });
  } catch (error) {
    console.error('刪除活動錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
