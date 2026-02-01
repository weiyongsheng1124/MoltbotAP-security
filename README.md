# Security News Bot

每日資安新聞訂閱機器人，自動從各大資安網站爬取新聞並發送到 Telegram。

## 功能

- 🤖 自動爬取資安新聞
- 🌐 支援中文與英文來源
- 📅 每天早上 8:00 自動發送
- 📱 Telegram 即時通知

## 新聞來源

### 英文
- BleepingComputer
- The Hacker News
- SecurityWeek

### 中文
- iThome
- iThome 資安

## 快速開始

```bash
# 安裝依賴
npm install

# 執行（測試模式）
node server.js

# 生產模式（需設定環境變數）
npm start
```

## Railway 部署

1. 建立 Railway 專案
2. 連結 GitHub 倉庫
3. 設定環境變數：
   - `TELEGRAM_TOKEN`
   - `TELEGRAM_CHAT_ID`
4. 自動部署完成

## 環境變數

| 變數 | 說明 |
|------|------|
| `TELEGRAM_TOKEN` | Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | 接收訊息的 Chat ID |
