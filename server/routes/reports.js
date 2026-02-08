const express = require('express');
const XLSX = require('xlsx');
const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/reports/users-xlsx
// @desc    導出用戶報告 XLSX（全部用戶、消費總額、充值記錄）
// @access  Private (Admin)
router.get('/users-xlsx', [auth, adminAuth], async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 }).lean();
    const balances = await UserBalance.find({}).lean();
    const balanceByUser = {};
    balances.forEach((b) => {
      balanceByUser[b.user.toString()] = b;
    });

    const rechargeCount = (ub) => {
      if (!ub || !ub.transactions) return 0;
      return ub.transactions.filter((t) => t.type === 'recharge').length;
    };

    const rows = users.map((u) => {
      const ub = balanceByUser[u._id.toString()];
      return {
        '姓名': u.name || '',
        '電郵': u.email || '',
        '電話': u.phone || '',
        '角色': u.role || 'user',
        '會員等級': u.membershipLevel || 'basic',
        'VIP 到期': u.membershipExpiry ? new Date(u.membershipExpiry).toLocaleDateString('zh-TW') : '',
        '註冊日期': u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-TW') : '',
        '當前餘額(積分)': ub ? ub.balance : 0,
        '消費總額(積分)': ub ? ub.totalSpent : 0,
        '充值總額(積分)': ub ? ub.totalRecharged : 0,
        '充值筆數': rechargeCount(ub)
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '用戶報告');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `用戶報告_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buf);
  } catch (error) {
    console.error('導出用戶報告錯誤:', error);
    res.status(500).json({ message: '導出失敗，請稍後再試' });
  }
});

module.exports = router;
