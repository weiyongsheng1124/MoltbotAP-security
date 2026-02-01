const axios = require('axios');
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

// 模擬瀏覽器請求頭
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
};

// 資安新聞來源（RSS feed 更穩定）
const NEWS_SOURCES = [
    // RSS Feeds（最可靠）
    {
        name: 'Krebs on Security',
        url: 'https://krebsonsecurity.com/feed/',
        isRss: true,
        extract: (item) => ({
            title: item.title,
            link: item.link,
            source: 'Krebs on Security'
        })
    },
    {
        name: 'Dark Reading',
        url: 'https://www.darkreading.com/rss',
        isRss: true,
        extract: (item) => ({
            title: item.title,
            link: item.link,
            source: 'Dark Reading'
        })
    },
    {
        name: 'The Hacker News',
        url: 'https://feeds.feedburner.com/TheHackersNews',
        isRss: true,
        extract: (item) => ({
            title: item.title,
            link: item.link,
            source: 'The Hacker News'
        })
    },
    {
        name: 'Threatpost',
        url: 'https://threatpost.com/feed/',
        isRss: true,
        extract: (item) => ({
            title: item.title,
            link: item.link,
            source: 'Threatpost'
        })
    },
    {
        name: 'BleepingComputer',
        url: 'https://www.bleepingcomputer.com/feed/',
        isRss: true,
        extract: (item) => ({
            title: item.title,
            link: item.link,
            source: 'BleepingComputer'
        })
    },
    {
        name: 'SecurityWeek',
        url: 'https://www.securityweek.com/rss.xml',
        isRss: true,
        extract: (item) => ({
            title: item.title,
            link: item.link,
            source: 'SecurityWeek'
        })
    },
    // 中文來源（使用 RSS）
    {
        name: 'iThome',
        url: 'https://www.ithome.com.tw/rss',
        isRss: true,
        extract: (item) => ({
            title: item.title,
            link: item.link,
            source: 'iThome'
        })
    },
    {
        name: 'T 客邦',
        url: 'https://www.techbang.com/rss/categories/security',
        isRss: true,
        extract: (item) => ({
            title: item.title,
            link: item.link,
            source: 'T 客邦'
        })
    }
];

// 解析 RSS
function parseRSS(xmlData) {
    const news = [];
    try {
        // 簡單的 XML 解析
        const items = xmlData.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
        
        for (const item of items) {
            const titleMatch = item.match(/<title[^>]*>([^<]+)<\/title>/i);
            
            // 多種 link 格式的解析
            let linkMatch = item.match(/<link[^>]*>([^<]+)<\/link>/i);
            if (!linkMatch) {
                linkMatch = item.match(/<link[^>]*href="([^"]+)"[^>]*>/i);
            }
            if (!linkMatch) {
                linkMatch = item.match(/<link[^>]*href='([^']+)'[^>]*>/i);
            }
            
            if (titleMatch && linkMatch) {
                let title = titleMatch[1].trim();
                let link = linkMatch[1].trim();
                
                // 過濾無效標題和 link
                if (title && title.length > 10 && title !== 'undefined' && link && link.startsWith('http')) {
                    news.push({ title, link });
                }
            }
        }
    } catch (err) {
        console.log(`解析錯誤: ${err.message}`);
    }
    return news;
}

// 爬取單一來源的新聞
async function fetchNewsFromSource(source) {
    try {
        const response = await axios.get(source.url, {
            headers,
            timeout: 15000
        });
        
        let news = [];
        
        if (source.isRss) {
            news = parseRSS(response.data);
        }
        
        // 最多取 5 則
        news = news.slice(0, 5).map(item => source.extract(item));
        
        console.log(`✅ ${source.name}: ${news.length} 則`);
        return news;
    } catch (err) {
        console.log(`⚠️ ${source.name}: 失敗 - ${err.message.substring(0, 40)}`);
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
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`📰 共 ${allNews.length} 則新聞`);
    return allNews;
}

// 抓取 CISA 漏洞通報（最新 5 個）
async function fetchCVEs() {
    try {
        console.log('🔍 抓取 CISA 漏洞通報...');
        const response = await axios.get('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
            headers,
            timeout: 30000
        });
        
        const data = response.data;
        const cves = data.vulnerabilities || [];
        
        // 取最新 5 個（按 dateAdded 排序）
        const recentCVEs = cves
            .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
            .slice(0, 5)
            .map(item => ({
                cve: item.cveID,
                product: item.vendorProject,
                description: item.vulnerabilityName,
                dateAdded: item.dateAdded,
                dueDate: item.dueDate,
                link: `https://www.cve.org/CVERecord?id=${item.cveID}`
            }));
        
        console.log(`✅ CISA: ${recentCVEs.length} 個最新漏洞`);
        return recentCVEs;
    } catch (err) {
        console.log(`⚠️ CISA 抓取失敗: ${err.message.substring(0, 50)}`);
        return [];
    }
}

// 格式化 CVE 訊息
function formatCVEMessage(cveList) {
    if (cveList.length === 0) {
        return null;
    }
    
    let message = `🔐 <b>CISA 資安漏洞通報</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    cveList.forEach((cve, index) => {
        const shortDesc = cve.description.length > 80 
            ? cve.description.substring(0, 80) + '...' 
            : cve.description;
        message += `<b>${cve.cve}</b> - ${cve.product}\n`;
        message += `${index + 1}. ${shortDesc}\n`;
        message += `📅 ${cve.dateAdded} | 🔗 <a href="${cve.link}">詳細資料</a>\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🕐 ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`;
    
    return message;
}

// 發送 CVE 通知
async function sendTelegramCVEs(cveList) {
    if (!telegramBot || !chatId || cveList.length === 0) {
        return false;
    }
    
    const message = formatCVEMessage(cveList);
    
    try {
        await telegramBot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        console.log('✅ CISA 漏洞通知已發送');
        return true;
    } catch (err) {
        console.log(`⚠️ CVE Telegram 發送失敗: ${err.message}`);
        return false;
    }
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
            message += `   🔗 <a href="${item.link}">${item.link}</a>\n\n`;
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
    const cves = await fetchCVEs();
    
    if (news.length > 0) {
        await sendTelegramNews(news);
    }
    if (cves.length > 0) {
        await sendTelegramCVEs(cves);
    }
    
    return { news, cves };
}

// 測試模式
if (require.main === module) {
    console.log('🧪 測試模式\n');
    fetchAndSendNews().then(result => {
        console.log(`\n📊 新聞: ${result.news.length} 則 | CVE: ${result.cves.length} 個`);
    }).catch(err => {
        console.error('❌ 錯誤:', err.message);
        process.exit(1);
    });
}

// 排程：每天早上 8:30（台灣時間）
cron.schedule('30 8 * * *', () => {
    console.log('\n⏰ 排程觸發');
    fetchAndSendNews();
});

console.log('🔒 資安新聞機器人已啟動');
console.log('📅 排程：每天 8:30 AM TW\n');
