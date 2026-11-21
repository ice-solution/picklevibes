/**
 * 已停用（PickCourt）。
 * 舊版會執行 VIP 自動續期 + 過期降級；而家唔再檢查／改寫會籍。
 *
 * 用法（會直接退出）：node server/scripts/checkExpiredMemberships.js
 */
console.log('已停用：PickCourt 不再執行 VIP 自動續期或過期檢查。');
process.exit(0);
