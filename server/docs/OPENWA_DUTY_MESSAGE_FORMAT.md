# OpenWA 夜間值班訊息格式備份

## v1（2026-07-19 前，詳細場次版）— 已停用，僅作備份

### 即時新預約
```
🚨【{store.name}】夜間時段新預約
日期：{YYYY-MM-DD}
• {startTime}-{endTime} {courtName}（{number}號） · {userName} {phone}
狀態：{status}
```

### 時段整點匯總（含跨日）
```
📋【{store.name}】值班時段場次匯總
時段：{today} {From} → {nextDay} {To}   （或同日 From–To）
共 {n} 場
• {date} {startTime}-{endTime} {courtName}（{number}號） · {userName} {phone}
…
```

### 紅日 08:00
```
🧧【{store.name}】紅日場次通知
日期：{YYYY-MM-DD}（系統紅日）
共 {n} 場
• {startTime}-{endTime} {courtName}（{number}號） · {userName} {phone}
…
```

---

## v2（現行）— 加冷氣時間精簡版

### 時段整點匯總 / 紅日匯總
```
{store.name}需要加冷氣時間：
22:00-23:00
05:00-06:00
```
- 不寫場地、人員、場次標題
- 同一時段多場只列一次時間

### 時段內新增預約（即時）
```
{store.name}需要加冷氣時間：
{YYYY-MM-DD} {startTime}-{endTime}
```
- 只寫日期 + 時間
