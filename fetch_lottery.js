const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function scrapeData() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--lang=zh-CN,zh'
        ]
    });

    try {
        const page = await browser.newPage();

        // 访问目标网页
        await page.goto('https://www.cwl.gov.cn/ygkj/kjgg/', {
            waitUntil: 'networkidle0'
        });

        // 抓取数据
        const lotteryData = await page.evaluate(() => {
            const result = {
                ssq: {}, // 双色球
                kl8: {}, // 快乐8
                fc3d: {}, // 福彩3D
                qlc: {}  // 七乐彩
            };

            // 提取数字的辅助函数
            const extractNumber = (str) => {
                const matches = str.match(/\d+/g);
                return matches ? matches.join('') : '';
            };

            // 提取金额的辅助函数
            const extractAmount = (str) => {
                if (!str) return 0;
                // 去除￥和元符号，去除逗号，然后提取数字（包括小数点）
                const matches = str.replace(/[¥,元]/g, '').match(/\d+\.?\d*/);
                if (!matches) return 0;
                // 转为数字并取整
                return Math.floor(parseFloat(matches[0]));
            };

            // 抓取双色球数据
            const ssqElement = document.querySelector('.notice-item.ssq');
            if (ssqElement) {
                result.ssq = {
                    name: 'ssq',
                    period: parseInt(extractNumber(ssqElement.querySelector('.stage')?.textContent || '')),
                    poolAmount: extractAmount(ssqElement.querySelector('.red')?.textContent || '0'),
                    numbers: Array.from(ssqElement.querySelectorAll('.qiu .lotteryNum')).map(num => parseInt(num.textContent)),
                    links: {
                        detail: ssqElement.querySelector('.ssqXqLink')?.href,
                        history: ssqElement.querySelector('a[href*="/ygkj/wqkjgg/ssq/"]')?.href,
                        video: ssqElement.querySelector('.ssqSpLink')?.href
                    }
                };
            }

            // 抓取快乐8数据
            const kl8Element = document.querySelector('.notice-item.kl8');
            if (kl8Element) {
                result.kl8 = {
                    name: 'kl8',
                    period: parseInt(extractNumber(kl8Element.querySelector('.stage')?.textContent || '')),
                    poolAmount: extractAmount(kl8Element.querySelector('.red')?.textContent || '0'),
                    numbers: Array.from(kl8Element.querySelectorAll('.qiu .lotteryNum')).map(num => parseInt(num.textContent)),
                    links: {
                        detail: kl8Element.querySelector('.kl8XqLink')?.href,
                        history: kl8Element.querySelector('a[href*="/ygkj/wqkjgg/kl8/"]')?.href,
                        video: kl8Element.querySelector('.kl8SpLink')?.href
                    }
                };
            }

            // 抓取福彩3D数据
            const fc3dElement = document.querySelector('.notice-item.fc3d');
            if (fc3dElement) {
                result.fc3d = {
                    name: 'fc3d',
                    period: parseInt(extractNumber(fc3dElement.querySelector('.stage')?.textContent || '')),
                    numbers: Array.from(fc3dElement.querySelectorAll('.qiu .lotteryNum')).map(num => parseInt(num.textContent)),
                    links: {
                        detail: fc3dElement.querySelector('.fcXqLink')?.href,
                        history: fc3dElement.querySelector('a[href*="/ygkj/wqkjgg/fc3d/"]')?.href
                    }
                };
            }

            // 抓取七乐彩数据
            const qlcElement = document.querySelector('.notice-item.qcl');
            if (qlcElement) {
                result.qlc = {
                    name: 'qlc',
                    period: parseInt(extractNumber(qlcElement.querySelector('.stage')?.textContent || '')),
                    poolAmount: extractAmount(qlcElement.querySelector('.red')?.textContent || '0'),
                    numbers: Array.from(qlcElement.querySelectorAll('.qiu .lotteryNum')).map(num => parseInt(num.textContent)),
                    links: {
                        detail: qlcElement.querySelector('.qlcXqLink')?.href,
                        history: qlcElement.querySelector('a[href*="/ygkj/wqkjgg/qlc/"]')?.href,
                        video: qlcElement.querySelector('.qlcSpLink')?.href
                    }
                };
            }

            return result;
        });

        // 为所有链接添加域名前缀
        const baseUrl = 'https://www.cwl.gov.cn';
        ['ssq', 'kl8', 'fc3d', 'qlc'].forEach(type => {
            if (lotteryData[type].links) {
                Object.keys(lotteryData[type].links).forEach(linkType => {
                    if (lotteryData[type].links[linkType] && lotteryData[type].links[linkType].startsWith('/')) {
                        lotteryData[type].links[linkType] = baseUrl + lotteryData[type].links[linkType];
                    }
                });
            }
        });

        return lotteryData;
    } catch (error) {
        console.error('抓取数据时出错:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// 确保数据目录存在
async function ensureDataDir() {
    const dataDir = path.join(__dirname, 'data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir);
    }
    return dataDir;
}

// 主函数
async function main() {
    try {
        const dataDir = await ensureDataDir();
        const data = await scrapeData();
        await fs.writeFile(
            path.join(dataDir, 'lottery_data.json'),
            JSON.stringify(data, null, 2),
            'utf8'
        );
        console.log('数据已成功保存到 lottery_data.json');
    } catch (error) {
        console.error('程序执行出错:', error);
        process.exit(1);
    }
}

main(); 