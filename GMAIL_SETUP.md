# Gmail SMTP 配置說明

為了使用忘記密碼功能，您需要配置Gmail SMTP設置。

## 1. 啟用Gmail應用程序密碼

1. 登入您的Gmail帳戶
2. 前往 [Google帳戶設置](https://myaccount.google.com/)
3. 點擊「安全性」
4. 在「登入Google」部分，點擊「2步驟驗證」（如果未啟用，請先啟用）
5. 在「應用程式密碼」部分，點擊「應用程式密碼」
6. 選擇「郵件」和「其他（自訂名稱）」
7. 輸入應用程式名稱（例如：Picklevibes）
8. 點擊「產生」
9. 複製生成的16位密碼

## 2. 環境變量配置

在您的 `.env` 文件中添加以下配置：

```env
# Gmail SMTP 配置
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-digit-app-password

# 客戶端URL（用於生成重置鏈接）
CLIENT_URL=http://localhost:3000
```

## 3. 測試郵件發送

配置完成後，您可以測試忘記密碼功能：

1. 訪問 `/forgot-password` 頁面
2. 輸入您的電子郵件地址
3. 檢查您的郵箱是否收到重置密碼郵件

## 注意事項

- 使用應用程序密碼而不是您的Gmail帳戶密碼
- 應用程序密碼是16位字符，不包含空格
- 如果更改了Gmail密碼，需要重新生成應用程序密碼
- 建議在生產環境中使用專用的郵件服務（如SendGrid、Mailgun等）

## 故障排除

如果郵件發送失敗，請檢查：

1. Gmail用戶名是否正確
2. 應用程序密碼是否正確
3. 2步驟驗證是否已啟用
4. 網絡連接是否正常
5. 服務器日誌中的錯誤信息


