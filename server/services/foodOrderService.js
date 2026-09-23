const Booking = require('../models/Booking');
const FoodItem = require('../models/FoodItem');
const FoodOrder = require('../models/FoodOrder');
const Store = require('../models/Store');
const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const { getHKCalendarYMD, bookingRangeUtcMs } = require('../utils/bookingDateTime');
const whatsappMessaging = require('./whatsappMessagingService');

const ACTIVE_BOOKING_STATUSES = ['confirmed', 'pending'];

function isBookingActiveNow(booking, nowMs = Date.now()) {
  if (!booking) return false;
  const ymd = getHKCalendarYMD(booking.date instanceof Date ? booking.date : new Date(booking.date));
  const { startMs, endMs } = bookingRangeUtcMs(ymd, booking.startTime, booking.endTime);
  return nowMs >= startMs && nowMs < endMs;
}

/**
 * 找出用戶「目前進行中」的預約（可選店鋪）
 */
async function findActiveBookingsForUser(userId, storeId = null) {
  const filter = {
    user: userId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  };
  if (storeId) filter.store = storeId;

  const candidates = await Booking.find(filter)
    .populate('store', 'name slug')
    .populate('court', 'name')
    .sort({ date: -1, startTime: -1 })
    .limit(40)
    .lean();

  const nowMs = Date.now();
  return candidates.filter((b) => isBookingActiveNow(b, nowMs));
}

async function findActiveBookingById(userId, bookingId) {
  const booking = await Booking.findOne({
    _id: bookingId,
    user: userId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  })
    .populate('store', 'name slug foodOrderNotify')
    .populate('court', 'name')
    .lean();

  if (!booking || !isBookingActiveNow(booking)) return null;
  return booking;
}

function formatOrderNotifyText({ storeName, userName, userPhone, courtName, startTime, endTime, items, totalPoints, notes, orderId }) {
  const lines = items.map((it) => `· ${it.name} x${it.quantity}（${it.lineTotal} 積分）`);
  return [
    '【新訂餐】',
    `店鋪：${storeName || '-'}`,
    `客人：${userName || '-'}${userPhone ? ` / ${userPhone}` : ''}`,
    `場地：${courtName || '-'} ${startTime || ''}-${endTime || ''}`,
    `訂單：${String(orderId).slice(-6)}`,
    '── 內容 ──',
    ...lines,
    `合計：${totalPoints} 積分`,
    notes ? `備註：${notes}` : null,
  ].filter(Boolean).join('\n');
}

async function notifyKitchen(store, order, user, booking) {
  const cfg = store?.foodOrderNotify;
  if (!cfg?.enabled) {
    return { skipped: true, reason: 'notify_disabled' };
  }
  const phones = (cfg.notifyPhones || []).map((p) => String(p || '').trim()).filter(Boolean);
  if (!phones.length) {
    return { skipped: true, reason: 'no_phones' };
  }

  const text = formatOrderNotifyText({
    storeName: store.name,
    userName: user?.name,
    userPhone: user?.phone,
    courtName: booking?.court?.name || booking?.court,
    startTime: booking?.startTime,
    endTime: booking?.endTime,
    items: order.items,
    totalPoints: order.totalPoints,
    notes: order.notes,
    orderId: order._id,
  });

  if (!whatsappMessaging.isWhatsAppConfigured()) {
    return { skipped: true, reason: 'whatsapp_not_configured' };
  }

  try {
    const results = await whatsappMessaging.sendTextToMany(phones, text);
    return { success: true, results };
  } catch (err) {
    console.error('訂餐通知失敗:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 下單：驗證進行中預約 → 扣積分 → 建單 → 通知廚房
 */
async function placeFoodOrder({ userId, bookingId, items, notes = '' }) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('請選擇至少一項餐點');
    err.status = 400;
    throw err;
  }

  const booking = await findActiveBookingById(userId, bookingId);
  if (!booking) {
    const err = new Error('目前沒有進行中的預約，無法訂餐。請於預約時段內再試。');
    err.status = 403;
    throw err;
  }

  const storeId = booking.store?._id || booking.store;
  if (!storeId) {
    const err = new Error('預約缺少店鋪資料');
    err.status = 400;
    throw err;
  }

  const normalized = items.map((row) => ({
    itemId: String(row.itemId || row.item || ''),
    quantity: Math.max(1, Math.min(99, Number(row.quantity) || 1)),
  })).filter((r) => r.itemId);

  if (!normalized.length) {
    const err = new Error('請選擇至少一項餐點');
    err.status = 400;
    throw err;
  }

  const itemIds = [...new Set(normalized.map((r) => r.itemId))];
  const dbItems = await FoodItem.find({
    _id: { $in: itemIds },
    store: storeId,
    isAvailable: true,
  }).lean();

  if (dbItems.length !== itemIds.length) {
    const err = new Error('部分餐點不存在、已下架或不屬於此店鋪');
    err.status = 400;
    throw err;
  }

  const byId = new Map(dbItems.map((i) => [String(i._id), i]));
  const orderItems = normalized.map((r) => {
    const item = byId.get(r.itemId);
    const lineTotal = item.price * r.quantity;
    return {
      item: item._id,
      name: item.name,
      price: item.price,
      quantity: r.quantity,
      lineTotal,
    };
  });

  const totalPoints = orderItems.reduce((sum, it) => sum + it.lineTotal, 0);
  if (totalPoints <= 0) {
    const err = new Error('訂單金額無效');
    err.status = 400;
    throw err;
  }

  let userBalance = await UserBalance.findOne({ user: userId });
  if (!userBalance) {
    userBalance = new UserBalance({ user: userId, balance: 0 });
    await userBalance.save();
  }
  if (userBalance.balance < totalPoints) {
    const err = new Error(`積分不足（需要 ${totalPoints}，餘額 ${userBalance.balance}）`);
    err.status = 400;
    throw err;
  }

  const order = await FoodOrder.create({
    user: userId,
    store: storeId,
    booking: booking._id,
    items: orderItems,
    totalPoints,
    notes: String(notes || '').trim().slice(0, 300),
    status: 'pending',
    pointsChargedAt: new Date(),
  });

  try {
    await userBalance.deductBalance(
      totalPoints,
      `訂餐 · ${orderItems.map((i) => `${i.name}x${i.quantity}`).join('、')}`.slice(0, 200),
      booking._id,
      null,
      null,
      null,
      order._id
    );
  } catch (e) {
    await FoodOrder.findByIdAndDelete(order._id);
    throw e;
  }

  const store = await Store.findById(storeId).lean();
  const user = await User.findById(userId).select('name phone').lean();
  const notifyResult = await notifyKitchen(store, order, user, booking);
  order.notifyResult = notifyResult;
  await order.save();

  return { order, notifyResult, balance: userBalance.balance };
}

module.exports = {
  ACTIVE_BOOKING_STATUSES,
  isBookingActiveNow,
  findActiveBookingsForUser,
  findActiveBookingById,
  placeFoodOrder,
  notifyKitchen,
};
