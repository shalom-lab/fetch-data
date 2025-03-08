const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function scrapeData() {
    try {
        // 启动浏览器
        const browser = await puppeteer.launch({
            headless: "new"
        });
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

        await browser.close();

        // 创建数据目录（如果不存在）
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }

        const fileName = path.join(dataDir, 'lottery_data.json');
        let existingData = { ssq: [], kl8: [], fc3d: [], qlc: [] };

        // 读取现有数据（如果存在）
        if (fs.existsSync(fileName)) {
            try {
                existingData = JSON.parse(fs.readFileSync(fileName, 'utf8'));
            } catch (err) {
                console.error('读取现有数据失败:', err);
            }
        }

        // 合并并去重数据
        ['ssq', 'kl8', 'fc3d', 'qlc'].forEach(type => {
            if (Object.keys(lotteryData[type]).length > 0) {
                // 将新数据添加到对应类型的数组中
                const newData = {
                    ...lotteryData[type],
                    fetchDate: new Date().toISOString()
                };

                // 确保数组存在
                if (!Array.isArray(existingData[type])) {
                    existingData[type] = [];
                }

                // 添加新数据
                existingData[type].push(newData);

                // 按period去重，保留最新的数据
                existingData[type] = Object.values(
                    existingData[type].reduce((acc, curr) => {
                        const period = curr.period;
                        if (!acc[period] || new Date(acc[period].fetchDate) < new Date(curr.fetchDate)) {
                            acc[period] = curr;
                        }
                        return acc;
                    }, {})
                );

                // 按期号排序（降序）
                existingData[type].sort((a, b) => b.period - a.period);
            }
        });

        // 保存合并后的数据
        fs.writeFileSync(fileName, JSON.stringify(existingData, null, 2));
        console.log(`数据已保存到: ${fileName}`);

    } catch (error) {
        console.error('抓取数据时出错:', error);
        process.exit(1);
    }
}

// 执行抓取
scrapeData(); 