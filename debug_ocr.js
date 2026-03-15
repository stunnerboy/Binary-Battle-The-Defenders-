const puppeteer = require('puppeteer');

async function run() {
    try {
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        let page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 720 });
        
        const ytId = '9IpspLDbmC-mD4J_r42RVY-pA'; 
        console.log("Navigating to Video Embed page...");
        await page.goto(`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1`, { waitUntil: 'domcontentloaded' });
        
        try {
            await page.waitForSelector('.ytp-large-play-button', { timeout: 8000 });
            console.log("Triggering layout gesture to start video stream...");
            await page.click('.ytp-large-play-button');
            await new Promise(r => setTimeout(r, 4000)); // buffer load
        } catch (e) {
            console.log("Play button not found or already playing.");
        }

        await page.evaluate(() => {
            const v = document.querySelector('video');
            if (v) { v.play(); v.muted = true; }
        });
        await new Promise(r => setTimeout(r, 3000));

        const duration = await page.evaluate(() => {
            const video = document.querySelector('video');
            return video ? video.duration : 0;
        });

        console.log("Actual Duration:", duration);
        
        // Take a test screenshot seek
        await page.evaluate(() => {
             const video = document.querySelector('video');
             if (video) { video.currentTime = 30; video.pause(); }
        });
        await new Promise(r => setTimeout(r, 1200));

        console.log("Taking test frame debug_final.jpg...");
        await page.screenshot({ path: 'debug_final.jpg' });

        await browser.close();
        console.log("Completed.");
    } catch (err) {
        console.error("Debug Error:", err);
    }
}

run();
