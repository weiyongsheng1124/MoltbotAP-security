const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');

// 設定台灣時區
process.env.TZ = 'Asia/Taipei';

// 初始化 Telegram Bot
let telegramBot = null;
let chatId = null;

function initTelegramBot() {
    const token = process.env.TELEGRAM_TOKEN;
    chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (token && chatId) {
        try {
            telegramBot = new TelegramBot(token, { polling: false });
            console.log('✅ Telegram Bot 已初始化');
        } catch (err) {
            console.log(`⚠️ Telegram Bot 初始化失敗: ${err.message}`);
        }
    } else {
        console.log('⚠️ Telegram 未設定（需要環境變數 TELEGRAM_TOKEN 和 TELEGRAM_CHAT_ID）');
    }
}

initTelegramBot();

// 資安新聞來源
const NEWS_SOURCES = [
    // 英文來源
    {
        name: 'BleepingComputer',
        url: 'https://www.bleepingcomputer.com/',
        selector: '.news-listing .news-summary',
        titleSelector: 'a.news-link',
        linkSelector: 'a.news-link',
        extract: ($, element) => ({
            title: $(element).find('a.news-link').text().trim(),
            url: 'https://www.bleepingcomputer.com' + $(element).find('a.news-link').attr('href'),
            source: 'BleepingComputer'
        })
    },
    {
        name: 'The Hacker News',
        url: 'https://thehackernews.com/',
        selector: '.story-list .story',
        titleSelector: 'h2.title a',
        linkSelector: 'h2.title a',
        extract: ($, element) => ({
            title: $(element).find('h2.title a').text().trim(),
            url: $(element).find('h2.title a').attr('href'),
            source: 'The Hacker News'
        })
    },
    {
        name: 'SecurityWeek',
        url: 'https://www.securityweek.com/',
        selector: '.views-row',
        titleSelector: 'h2 a',
        linkSelector: 'h2 a',
        extract: ($, element) => ({
            title: $(element).find('h2 a').text().trim(),
            url: $(element).find('h2 a').attr('href'),
            source: 'SecurityWeek'
        })
    },
    // 中文來源
    {
        name: 'iThome',
        url: 'https://www.ithome.com.tw/',
        selector: '.news-list .news-item',
        titleSelector: 'h3 a',
        linkSelector: 'h3 a',
        extract: ($, element) => ({
            title: $(element).find('h3 a').text().trim(),
            url: 'https://www.ithome.com.tw' + $(element).find('h3 a').attr('href'),
            source: 'iThome'
        })
    },
    {
        name: '資安趨勢',
        url: 'https://www.ithome.com.tw/category/security',
        selector: '.news-list .news-item',
        titleSelector: 'h3 a',
        linkSelector: 'h3 a',
        extract: ($, element) => ({
            title: $(element).find('h3 a').text().trim(),
            url: 'https://www.ithome.com.tw' + $(element).find('h3 a').attr('href'),
            source: 'iThome 資安'
        })
    }
];

// 爬取單一來源的新聞
async function fetchNewsFromSource(source) {
    try {
        const response = await axios.get(source.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        const news = [];
        
        $(source.selector).each((index, element) => {
            if (index >= 5) return; // 每個來源最多取 5 則
            
            try {
                const item = source.extract($, element);
                if (item.title && item.url && !item.url.includes('undefined')) {
                    // 過濾重複標題
                    const isDuplicate = news.some(n => n.title === item.title);
                    if (!isDuplicate) {
                        news.push(item);
                    }
                }
            } catch (err) {
                // 略過解析錯誤
            }
        });
        
        console.log(`✅ ${source.name}: 取得 ${news.length} 則新聞`);
        return news;
    } catch (err) {
        console.log(`⚠️ ${source.name}: 爬取失敗 - ${err.message}`);
        return [];
    }
}

// 爬取所有新聞
async function fetchAllNews() {
    console.log('🔍 開始爬取資安新聞...');
    const allNews = [];
    
    for (const source of NEWS_SOURCES) {
        const news = await fetchNewsFromSource(source);
        allNews.push(...news);
    }
    
    console.log(`📰 共取得 ${allNews.length} 則新聞`);
    return allNews;
}

// 格式化 Telegram 訊息
function formatNewsMessage(newsList) {
    if (newsList.length === 0) {
        return '❌ 今日沒有取得任何資安新聞';
    }
    
    let message = `🔒 <b>每日資安新聞</b> (${newsList.length} 則)\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // 按來源分組
    const grouped = {};
    newsList.forEach(news => {
        if (!grouped[news.source]) {
            grouped[news.source] = [];
        }
        grouped[news.source].push(news);
    });
    
    // 輸出各來源新聞
    for (const [source, news] of Object.entries(grouped)) {
        message += `📰 <b>${source}</b>\n`;
        news.forEach((item, index) => {
            const shortTitle = item.title.length > 50 
                ? item.title.substring(0, 50) + '...' 
                : item.title;
            message += `${index + 1}. ${shortTitle}\n`;
            message += `   🔗 ${item.url}\n\n`;
        });
    }
    
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🕐 更新時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;
    
    return message;
}

// 發送 Telegram 通知
async function sendTelegramNews(newsList) {
    if (!telegramBot || !chatId) {
        console.log('⚠️ Telegram 未設定，無法發送通知');
        return false;
    }
    
    const message = formatNewsMessage(newsList);
    
    try {
        await telegramBot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        console.log('✅ Telegram 通知已發送');
        return true;
    } catch (err) {
        console.log(`⚠️ Telegram 發送失敗: ${err.message}`);
        return false;
    }
}

// 主函數：取得新聞並發送
async function fetchAndSendNews() {
    const news = await fetchAllNews();
    await sendTelegramNews(news);
    return news;
}

// 測試模式：直接執行
if (require.main === module) {
    console.log('🧪 測試模式：手動執行新聞爬取');
    fetchAndSendNews().then(news => {
        console.log(`📊 共取得 ${news.length} 則新聞`);
    }).catch(err => {
        console.error('❌ 錯誤:', err.message);
        process.exit(1);
    });
}

// 排程：每天早上 8 點執行
cron.schedule('0 8 * * *', () => {
    console.log('⏰ 排程觸發：每日資安新聞');
    fetchAndSendNews();
});

console.log('🔒 資安新聞訂閱機器人已啟動');
console.log('📅 排程：每天早上 8:00 自動發送資安新聞');
