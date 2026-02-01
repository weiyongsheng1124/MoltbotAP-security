# Security News Skill

*每日資安新聞訂閱機器人*

---

## 📋 功能說明

- 自動爬取各大資安新聞網站
- 支援中文與英文來源
- 每天早上 8:00 自動發送到 Telegram
- 支援手動執行測試

---

## 📰 新聞來源

### 英文
| 名稱 | 網站 | 語言 |
|------|------|------|
| BleepingComputer | bleepingcomputer.com | 英文 |
| The Hacker News | thehackernews.com | 英文 |
| SecurityWeek | securityweek.com | 英文 |

### 中文
| 名稱 | 網站 | 語言 |
|------|------|------|
| iThome | ithome.com.tw | 繁體中文 |
| iThome 資安 | ithome.com.tw/category/security | 繁體中文 |

---

## 🛠️ 安裝與執行

```bash
cd security-news
npm install
npm start          # 啟動服務（會自動排程）
node server.js     # 測試模式：立即執行一次
```

---

## 🚀 Railway 部署

1. 建立新 Railway 專案
2. 連結 GitHub 倉庫
3. 設定環境變數：
   - `TELEGRAM_TOKEN` - Telegram Bot Token
   - `TELEGRAM_CHAT_ID` - 接收訊息的 Chat ID
4. 部署完成後自動每天 8:00 發送新聞

---

## 📝 環境變數

| 變數 | 說明 | 範例 |
|------|------|------|
| `TELEGRAM_TOKEN` | Telegram Bot Token | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` |
| `TELEGRAM_CHAT_ID` | 接收訊息的 Chat ID | `7711392074` |

---

## 🐛 常見問題

### Q: 新聞沒有如期發送？
A: 檢查 Railway 服務是否正常運行，以及環境變數是否正確設定。

### Q: 如何手動測試？
A: 在當地執行 `node server.js`，會立即爬取並發送新聞。

### Q: 如何新增新聞來源？
A: 在 `NEWS_SOURCES` 陣列中新增物件，參考現有格式。

---

## 📊 程式結構

```
security-news/
├── server.js        # 主程式（爬蟲 + 排程 + Telegram）
├── package.json     # 依賴設定
├── SKILL.md         # 本文件
└── README.md        # 專案說明
```

---

## 🔧 技術棧

- **axios** - HTTP 請求
- **cheerio** - HTML 解析
- **node-cron** - 排程任務
- **node-telegram-bot-api** - Telegram 通知

---

## 📌 Telegram 格式注意

### 連結語法
- ❌ **錯誤**：markdown 語法 `[文字](網址)` → 會顯示為 undefined
- ✅ **正確**：HTML 標籤 `<a href="網址">文字</a>`

```javascript
// 正確範例
const message = '資料來源：<a href="https://cisa.gov">CISA</a>';

// 錯誤範例（不要用）
const message = '資料來源：[CISA](https://cisa.gov)';
```
