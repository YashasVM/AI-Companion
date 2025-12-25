const { chromium } = require('playwright');

let browser = null;
let context = null;
let page = null;

async function initBrowser() {
    if (browser) return;

    // Launch browser in visible mode (MAXIMIZED)
    browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized'],
        executablePath: process.env.CHROME_PATH
    });

    context = await browser.newContext({ viewport: null });
    page = await context.newPage();
}

async function navigate(url) {
    if (!browser) await initBrowser();
    await page.goto(url);
}

async function search(query) {
    if (!browser) await initBrowser();
    await page.goto('https://duckduckgo.com');
    await page.fill('input[name="q"]', query);
    await page.press('input[name="q"]', 'Enter');
}

async function click(selector) {
    if (!page) return;
    await page.click(selector);
}

async function closeBrowser() {
    if (browser) {
        await browser.close();
        browser = null;
    }
}

module.exports = { navigate, search, click, closeBrowser };
