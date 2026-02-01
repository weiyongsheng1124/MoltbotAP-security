const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');

// 設定美國時區
process.env.TZ = 'America/New_York';

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
        name: 'Dark Reading',
        url: 'https://www.darkreading.com/',
        selector: '.dr-article-card',
        titleSelector: 'a.dr-article-card__title',
        linkSelector: 'a.dr-article-card__title',
        extract: ($, element) => ({
            title: $(element).text().trim(),
            url: 'https://www.darkreading.com' + $(element).attr('href'),
            source: 'Dark Reading'
        })
    },
    {
        name: 'Krebs on Security',
        url: 'https://krebsonsecurity.com/',
        selector: '.post',
        titleSelector: 'h2 a',
        linkSelector: 'h2 a',
        extract: ($, element) => ({
            title: $(element).find('h2 a').text().trim(),
            url: $(element).find('h2 a').attr('href'),
            source: 'Krebs on Security'
        })
    },
    {
        name: 'Threatpost',
        url: 'https://threatpost.com/',
        selector: '.article-card',
        titleSelector: 'h3 a',
        linkSelector: 'h3 a',
        extract: ($, element) => ({
            title: $(element).find('h3 a').text().trim(),
            url: $(element).find('h3 a').attr('href'),
            source: 'Threatpost'
        })
    },
    {
        name: 'BleepingComputer',
        url: 'https://www.bleepingcomputer.com/',
        selector: '.bc_latest_news .news_li',
        titleSelector: 'a',
        linkSelector: 'a',
        extract: ($, element) => ({
            title: $(element).find('a').text().trim(),
            url: 'https://www.bleepingcomputer.com' + $(element).find('a').attr('href'),
            source: 'BleepingComputer'
        })
    },
    {
        name: 'The Hacker News',
        url: 'https://thehackernews.com/',
        selector: '.home-post',
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
        selector: '.view-content .views-row',
        titleSelector: 'h2 a',
        linkSelector: 'h2 a',
        extract: ($, element) => ({
            title: $(element).find('h2 a').text().trim(),
            url: $(element).find('h2 a').attr('href'),
            source: 'SecurityWeek'
        })
    },
    {
        name: 'CSO Online',
        url: 'https://www.csoonline.com/news/security/',
        selector: '.river-well .card',
        titleSelector: 'a',
        linkSelector: 'a',
        extract: ($, element) => ({
            title: $(element).find('a').attr('title') || $(element).find('a').text().trim(),
            url: $(element).find('a').attr('href'),
            source: 'CSO Online'
        })
    },
    {
        name: 'ZDNet',
        url: 'https://www.zdnet.com/topic/security/',
        selector: '.topic-content .item',
        titleSelector: 'h3 a',
        linkSelector: 'h3 a',
        extract: ($, element) => ({
            title: $(element).find('h3 a').text().trim(),
            url: $(element).find('h3 a').attr('href'),
            source: 'ZDNet'
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
        name: 'iThome 資安',
        url: 'https://www.ithome.com.tw/category/security',
        selector: '.news-list .news-item',
        titleSelector: 'h3 a',
        linkSelector: 'h3 a',
        extract: ($, element) => ({
            title: $(element).find('h3 a').text().trim(),
            url: 'https://www.ithome.com.tw' + $(element).find('h3 a').attr('href'),
            source: 'iThome 資安'
        })
    },
    {
        name: 'T 客邦',
        url: 'https://www.techbang.com/categories/security',
        selector: '.main-list .post',
        titleSelector: 'h2 a',
        linkSelector: 'h2 a',
        extract: ($, element) => ({
            title: $(element).find('h2 a').text().trim(),
            url: $(element).find('h2 a').attr('href'),
            source: 'T 客邦'
        })
    },
    {
        name: '癮科技',
        url: 'https://www.cool3c.com/category/security',
        selector: '.article-list .article',
        titleSelector: 'a.title',
        linkSelector: 'a.title',
        extract: ($, element) => ({
            title: $(element).find('a.title').text().trim(),
            url: $(element).find('a.title').attr('href'),
            source: '癮科技'
        })
    }
];

// 爬取單一來源的新聞
async function fetchNewsFromSource(source) {
    try {
        const response = await axios.get(source.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        const news = [];
        
        // 嘗試使用自定義選擇器
        let elements = $(source.selector);
        
        // 如果找不到元素，嘗試通用選擇器
        if (elements.length === 0) {
            elements = $('article, .post, .article, .news-item');
        }
        
        elements.each((index, element) => {
            if (index >= 5) return; // 每個來源最多取 5 則
            
            try {
                let title = '';
                let url = '';
                
                // 嘗試使用自定義選擇器
                if (source.titleSelector) {
                    const titleEl = $(element).find(source.titleSelector);
                    title = titleEl.text().trim() || titleEl.attr('title') || '';
                    url = titleEl.attr('href') || '';
                } else {
                    // 通用解析
                    const linkEl = $(element).find('a[href]').first();
                    title = $(element).text().trim().substring(0, 100);
                    url = linkEl.attr('href') || '';
                }
                
                // 補全 URL
                if (url && !url.startsWith('http')) {
                    const urlObj = new URL(source.url);
                    url = urlObj.origin + url;
                }
                
                // 過濾條件
                if (title && title.length > 10 && url && url.startsWith('http')) {
                    // 過濾重複標題
                    const isDuplicate = news.some(n => 
                        n.title === title || 
                        (Math.abs(n.title.length - title.length) < 5 && n.title.includes(title))
                    );
                    if (!isDuplicate) {
                        news.push({ title, url, source: source.name });
                    }
                }
            } catch (err) {
                // 略過解析錯誤
            }
        });
        
        console.log(`✅ ${source.name}: ${news.length} 則`);
        return news;
    } catch (err) {
        console.log(`⚠️ ${source.name}: 失敗 - ${err.message.substring(0, 50)}`);
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
        // 避免請求過快
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`📰 共 ${allNews.length} 則新聞`);
    return allNews;
}

// 格式化 Telegram 訊息
function formatNewsMessage(newsList) {
    if (newsList.length === 0) {
        return '❌ 今日沒有取得任何資安新聞';
    }
    
    let message = `🔒 <b>Daily Security News</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // 按來源分組
    const grouped = {};
    newsList.forEach(news => {
        if (!grouped[news.source]) {
            grouped[news.source] = [];
        }
        grouped[news.source].push(news);
    });
    
    for (const [source, news] of Object.entries(grouped)) {
        message += `📰 <b>${source}</b>\n`;
        news.forEach((item, index) => {
            const shortTitle = item.title.length > 60 
                ? item.title.substring(0, 60) + '...' 
                : item.title;
            message += `${index + 1}. ${shortTitle}\n`;
            message += `   🔗 ${item.url}\n\n`;
        });
    }
    
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🕐 ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`;
    
    return message;
}

// 發送 Telegram 通知
async function sendTelegramNews(newsList) {
    if (!telegramBot || !chatId) {
        console.log('⚠️ Telegram 未設定');
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

// 主函數
async function fetchAndSendNews() {
    const news = await fetchAllNews();
    if (news.length > 0) {
        await sendTelegramNews(news);
    }
    return news;
}

// 測試模式
if (require.main === module) {
    console.log('🧪 測試模式');
    fetchAndSendNews().then(news => {
        console.log(`\n📊 共 ${news.length} 則新聞`);
    }).catch(err => {
        console.error('❌ 錯誤:', err.message);
        process.exit(1);
    });
}

// 排程：每天早上 8:00（美國時間）
cron.schedule('0 8 * * *', () => {
    console.log('\n⏰ 排程觸發');
    fetchAndSendNews();
});

console.log('🔒 資安新聞機器人已啟動');
console.log('📅 排程：每天 8:00 AM EST');
