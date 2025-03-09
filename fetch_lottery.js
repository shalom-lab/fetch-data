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
            // 提取数字的辅助函数
            const extractNumber = (str) => {
                const matches = str.match(/\\d+/g);
                return matches ? matches.join('') : '';
            };

            // 提取金额的辅助函数
            const extractAmount = (str) => {
                if (!str) return 0;
                // 去除￥和元符号，去除逗号，然后提取数字（包括小数点）
                const matches = str.replace(/[¥,元]/g, '').match(/\\d+\\.?\\d*/);
                if (!matches) return 0;
                // 转为数字并取整
                return Math.floor(parseFloat(matches[0]));
            };

            const result = {
                ssq: [], // 双色球
                kl8: [], // 快乐8
                fc3d: [], // 福彩3D
                qlc: []  // 七乐彩
            };

            // 抓取双色球数据
            const ssqElement = document.querySelector('.notice-item.ssq');
            if (ssqElement) {
                const ssqData = {
                    name: 'ssq',
                    date: new Date().toISOString().split('T')[0], // 添加日期
                    period: parseInt(extractNumber(ssqElement.querySelector('.stage')?.textContent || '')),
                    poolAmount: extractAmount(ssqElement.querySelector('.red')?.textContent || '0'),
                    numbers: Array.from(ssqElement.querySelectorAll('.qiu .lotteryNum')).map(num => parseInt(num.textContent)),
                    links: {
                        detail: ssqElement.querySelector('.ssqXqLink')?.href,
                        history: ssqElement.querySelector('a[href*="/ygkj/wqkjgg/ssq/"]')?.href,
                        video: ssqElement.querySelector('.ssqSpLink')?.href
                    }
                };
                result.ssq.push(ssqData);
            }

            // 抓取快乐8数据
            const kl8Element = document.querySelector('.notice-item.kl8');
            if (kl8Element) {
                const kl8Data = {
                    name: 'kl8',
                    date: new Date().toISOString().split('T')[0],
                    period: parseInt(extractNumber(kl8Element.querySelector('.stage')?.textContent || '')),
                    poolAmount: extractAmount(kl8Element.querySelector('.red')?.textContent || '0'),
                    numbers: Array.from(kl8Element.querySelectorAll('.qiu .lotteryNum')).map(num => parseInt(num.textContent)),
                    links: {
                        detail: kl8Element.querySelector('.kl8XqLink')?.href,
                        history: kl8Element.querySelector('a[href*="/ygkj/wqkjgg/kl8/"]')?.href,
                        video: kl8Element.querySelector('.kl8SpLink')?.href
                    }
                };
                result.kl8.push(kl8Data);
            }

            // 抓取福彩3D数据
            const fc3dElement = document.querySelector('.notice-item.fc3d');
            if (fc3dElement) {
                const fc3dData = {
                    name: 'fc3d',
                    date: new Date().toISOString().split('T')[0],
                    period: parseInt(extractNumber(fc3dElement.querySelector('.stage')?.textContent || '')),
                    numbers: Array.from(fc3dElement.querySelectorAll('.qiu .lotteryNum')).map(num => parseInt(num.textContent)),
                    links: {
                        detail: fc3dElement.querySelector('.fcXqLink')?.href,
                        history: fc3dElement.querySelector('a[href*="/ygkj/wqkjgg/fc3d/"]')?.href
                    }
                };
                result.fc3d.push(fc3dData);
            }

            // 抓取七乐彩数据
            const qlcElement = document.querySelector('.notice-item.qcl');
            if (qlcElement) {
                const qlcData = {
                    name: 'qlc',
                    date: new Date().toISOString().split('T')[0],
                    period: parseInt(extractNumber(qlcElement.querySelector('.stage')?.textContent || '')),
                    poolAmount: extractAmount(qlcElement.querySelector('.red')?.textContent || '0'),
                    numbers: Array.from(qlcElement.querySelectorAll('.qiu .lotteryNum')).map(num => parseInt(num.textContent)),
                    links: {
                        detail: qlcElement.querySelector('.qlcXqLink')?.href,
                        history: qlcElement.querySelector('a[href*="/ygkj/wqkjgg/qlc/"]')?.href,
                        video: qlcElement.querySelector('.qlcSpLink')?.href
                    }
                };
                result.qlc.push(qlcData);
            }

            return result;
        });

        // 为所有链接添加域名前缀
        const baseUrl = 'https://www.cwl.gov.cn';
        ['ssq', 'kl8', 'fc3d', 'qlc'].forEach(type => {
            lotteryData[type].forEach(item => {
                if (item.links) {
                    Object.keys(item.links).forEach(linkType => {
                        if (item.links[linkType] && item.links[linkType].startsWith('/')) {
                            item.links[linkType] = baseUrl + item.links[linkType];
                        }
                    });
                }
            });
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

// 合并数据并去重
function mergeAndDeduplicate(existingData, newData) {
    const result = { ssq: [], kl8: [], fc3d: [], qlc: [] };
    
    ['ssq', 'kl8', 'fc3d', 'qlc'].forEach(type => {
        // 合并现有数据和新数据
        const combined = [...(existingData[type] || []), ...(newData[type] || [])];
        
        // 使用 Map 根据期号去重
        const uniqueMap = new Map();
        combined.forEach(item => {
            if (!uniqueMap.has(item.period) || 
                new Date(item.date) > new Date(uniqueMap.get(item.period).date)) {
                uniqueMap.set(item.period, item);
            }
        });
        
        // 转换回数组并按期号降序排序
        result[type] = Array.from(uniqueMap.values())
            .sort((a, b) => b.period - a.period);
    });
    
    return result;
}

// 主函数
async function main() {
    try {
        const dataDir = await ensureDataDir();
        const dataPath = path.join(dataDir, 'lottery_data.json');
        
        // 读取现有数据
        let existingData = { ssq: [], kl8: [], fc3d: [], qlc: [] };
        try {
            const fileContent = await fs.readFile(dataPath, 'utf8');
            existingData = JSON.parse(fileContent);
        } catch (error) {
            console.log('没有找到现有数据文件，将创建新文件');
        }

        // 抓取新数据
        const newData = await scrapeData();
        
        // 合并数据并去重
        const mergedData = mergeAndDeduplicate(existingData, newData);

        // 保存合并后的数据
        await fs.writeFile(
            dataPath,
            JSON.stringify(mergedData, null, 2),
            'utf8'
        );
        console.log('数据已成功保存到 lottery_data.json');
    } catch (error) {
        console.error('程序执行出错:', error);
        process.exit(1);
    }
}

main();