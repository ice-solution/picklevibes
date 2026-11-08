/**
 * 為現有店鋪補上預設預約政策文案（只填空欄，不覆蓋已有內容）
 * Usage: node server/scripts/seedStoreBookingPolicies.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/Store');
const {
  DEFAULT_CANCELLATION_LINES,
  DEFAULT_IMPORTANT_REMINDERS_LINES,
  DEFAULT_USAGE_NOTICE,
} = require('../utils/storeBookingPolicies');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const cancellationText = DEFAULT_CANCELLATION_LINES.join('\n');
  const importantRemindersText = DEFAULT_IMPORTANT_REMINDERS_LINES.join('\n');
  const usageNoticeText = DEFAULT_USAGE_NOTICE;

  const stores = await Store.find({}).select('name slug bookingPolicies');
  let updated = 0;
  for (const store of stores) {
    if (!store.bookingPolicies) store.bookingPolicies = {};
    let dirty = false;
    if (!String(store.bookingPolicies.cancellationText || '').trim()) {
      store.bookingPolicies.cancellationText = cancellationText;
      dirty = true;
    }
    if (!String(store.bookingPolicies.importantRemindersText || '').trim()) {
      store.bookingPolicies.importantRemindersText = importantRemindersText;
      dirty = true;
    }
    if (!String(store.bookingPolicies.usageNoticeText || '').trim()) {
      store.bookingPolicies.usageNoticeText = usageNoticeText;
      dirty = true;
    }
    if (dirty) {
      store.markModified('bookingPolicies');
      // eslint-disable-next-line no-await-in-loop
      await store.save();
      updated += 1;
      console.log(`✓ ${store.slug || store.name}`);
    }
  }

  console.log(`Done. Updated ${updated}/${stores.length} stores.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
