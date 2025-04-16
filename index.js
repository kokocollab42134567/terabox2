const puppeteer = require('puppeteer');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');




const app = express();

const COOKIES_FILE = path.join(__dirname, 'terabox_cookies.json');
const LOGIN_URL = 'https://www.terabox.com/';
const EMAIL = 'rrymouss@gmail.com';
const PASSWORD = 'kokohihi.123';
const UPDATE_INTERVAL = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

// Function to log in and update cookies
async function updateCookies() {
    const browser = await puppeteer.launch({
        headless: "new",  // Use 'new' for improved headless mode
        protocolTimeout: 180000, // Increased protocol timeout for stability
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, // Use default if not set
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-features=IsolateOrigins,site-per-process', // More stable site isolation
            '--disable-web-security',
            '--disable-http2', // Disable HTTP/2 if causing issues
            '--proxy-server="direct://"',
            '--proxy-bypass-list=*',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-accelerated-2d-canvas',
            '--disable-ipc-flooding-protection',
            '--enable-features=NetworkService,NetworkServiceInProcess',
        ],
        ignoreDefaultArgs: ['--disable-extensions'], // Allow extensions if needed
        defaultViewport: null, // Avoid viewport resizing issues
    });
    const page = await browser.newPage();

    console.log('Opening TeraBox...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Click the login button
    await page.waitForSelector('.lgoin-btn', { timeout: 10000 });
    await page.click('.lgoin-btn');

    // Wait for the "Other Login Options" section
    await page.waitForSelector('.other-item', { timeout: 10000 });

    // Click the second div inside .other-item (email login)
    await page.evaluate(() => {
        document.querySelectorAll('.other-item div')[1].click();
    });

    // Wait for email/password fields
    await page.waitForSelector('#email-input', { timeout: 10000 });
    await page.waitForSelector('#pwd-input', { timeout: 10000 });
    await page.waitForSelector('.btn-class-login', { timeout: 10000 });

    // Fill login details
    await page.type('#email-input', EMAIL, { delay: 100 });
    await page.type('#pwd-input', PASSWORD, { delay: 100 });

    // Click login button
    await page.click('.btn-class-login');

    // Wait for login to complete
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Login successful! Saving cookies...');
    const cookies = await page.cookies();
    const fs = require('fs'); // Use the standard fs module

await fs.promises.writeFile(COOKIES_FILE, JSON.stringify(cookies, null, 2));



    console.log(`Cookies updated and saved to ${COOKIES_FILE}`);
    await browser.close();
}
const SELF_CHECK_URL = "https://terabox2-production.up.railway.app/hi";

async function checkServerHealth() {
    try {
        const response = await axios.get(SELF_CHECK_URL);
        console.log(`🔄 Self-check response: ${response.data}`);
    } catch (error) {
        console.error("❌ Self-check failed:", error.message);
    }
}

// Run the health check every 10 seconds
setInterval(checkServerHealth, 10000);

// Function to schedule cookie updates every 3 days
async function scheduleCookieUpdates() {
    console.log('Cookie updater started. Running every 3 days...');
    await updateCookies(); // Run once immediately
    setInterval(updateCookies, UPDATE_INTERVAL); // Schedule updates every 3 days
}

// Start the updater
scheduleCookieUpdates();

const port = process.env.PORT || 3000;
const COOKIES_PATH = path.resolve(__dirname, 'terabox_cookies.json');
app.use((req, res, next) => {
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow CORS for debugging
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Enable CORS
app.use(cors());
app.get('/hi', (req, res) => {
    console.log("✅ /hi endpoint was accessed.");
    res.send("hi");
});

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);  // ✅ Store files in 'uploads/' folder
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + '-' + file.originalname); // Unique filename
        }
    }),
    limits: { fileSize: 500 * 1024 * 1024 } // Increase limit if needed
});



async function uploadToTeraBox(filePath, fileName) {
    const MAX_RETRIES = 3;
    let attempt = 0;
    let requestId = Date.now();

    while (attempt < MAX_RETRIES) {
        let browser;
        let uploadPage;

        try {
            console.log(`🔄 Attempt ${attempt + 1}/${MAX_RETRIES} for file: ${fileName} (Request ID: ${requestId})`);

            browser = await puppeteer.launch({
                headless: "new",
                protocolTimeout: 180000,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-web-security',
                    '--disable-http2',
                    '--proxy-server="direct://"',
                    '--proxy-bypass-list=*',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-accelerated-2d-canvas',
                    '--disable-ipc-flooding-protection',
                    '--enable-features=NetworkService,NetworkServiceInProcess',
                ],
                ignoreDefaultArgs: ['--disable-extensions'],
                defaultViewport: null,
            });

            uploadPage = await browser.newPage();
            await uploadPage.setViewport({ width: 1280, height: 800 });
            await uploadPage.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
            );

            // Load cookies
            if (fs.existsSync(COOKIES_PATH)) {
                const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
                await uploadPage.setCookie(...cookies);
            }

            console.log("🌍 Navigating to TeraBox...");
            await uploadPage.goto('https://www.terabox.com/main?category=all', { waitUntil: 'load', timeout: 60000 });
            console.log("✅ Page loaded successfully.");

            const fileInputSelector = 'input#h5Input0';
            await uploadPage.waitForSelector(fileInputSelector, { visible: true, timeout: 20000 });

            // Get initial row count
            const getRowCount = async () => {
                return await uploadPage.evaluate(() => {
                    return document.querySelectorAll('tbody tr').length;
                });
            };

            const initialRowCount = await getRowCount();
            console.log("📊 Initial row count:", initialRowCount);

            // Upload the file
            const inputUploadHandle = await uploadPage.$(fileInputSelector);
            await inputUploadHandle.uploadFile(filePath);
            console.log(`📤 File selected for upload: ${filePath}`);

            const successSelector = '.status-success.file-list';
            const progressSelector = '.status-uploading.file-list .progress-now.progress-common';

            // Monitor progress
            console.log("⏳ Checking for upload status...");
            const isUploaded = await uploadPage.evaluate((selector) => {
                return !!document.querySelector(selector);
            }, successSelector);

            if (isUploaded) {
                console.log("✅ Upload completed instantly.");
            } else {
                console.log("⏳ Upload in progress, tracking dynamically...");
                await new Promise(async (resolve) => {
                    let lastProgress = "";

                    const checkProgress = async () => {
                        try {
                            const progress = await uploadPage.evaluate((selector) => {
                                const el = document.querySelector(selector);
                                return el ? el.style.width : null;
                            }, progressSelector);

                            if (progress && progress !== lastProgress) {
                                console.log(`📊 Upload Progress: ${progress}`);
                                lastProgress = progress;
                            }

                            const done = await uploadPage.evaluate((selector) => {
                                return !!document.querySelector(selector);
                            }, successSelector);

                            if (done || progress === "100%") {
                                console.log("✅ Upload completed!");
                                resolve();
                            } else {
                                setTimeout(checkProgress, 1000);
                            }
                        } catch (e) {
                            console.log("⚠️ Error tracking progress, retrying...");
                            setTimeout(checkProgress, 1000);
                        }
                    };

                    checkProgress();
                });
            }

            // Wait for new row to appear
            console.log("⏳ Waiting for file list to refresh...");
            await uploadPage.waitForFunction(
                (initial) => {
                    return document.querySelectorAll('tbody tr').length > initial;
                },
                { timeout: 600000 },
                initialRowCount
            );

            console.log("✅ File list refreshed with new file.");

            await uploadPage.close();
            await browser.close();
            console.log("❎ Closed the browser.");

            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted temporary file: ${filePath}`);

            return { success: true, filename: fileName };

        } catch (error) {
            console.error(`❌ Upload error on attempt ${attempt + 1}:`, error);
            attempt++;

            if (uploadPage) await uploadPage.close();
            if (browser) await browser.close();
        }
    }

    return { success: false, error: "Upload failed after multiple attempts." };
}


app.post('/upload', (req, res) => {
    let receivedBytes = 0;
    let loggedMB = 0;
    const originalFilename = req.headers['filename']; // Get filename from header

if (!originalFilename) {
    return res.status(400).json({ success: false, message: "Filename is required in headers." });
}

const filePath = path.join(uploadDir, originalFilename); // Use filename as is



    const writeStream = fs.createWriteStream(filePath);

    console.log("📥 Upload started...");

    req.on('data', (chunk) => {
        receivedBytes += chunk.length;
        writeStream.write(chunk);

        // Log every 1MB received
        const receivedMB = Math.floor(receivedBytes / (1024 * 1024));
        if (receivedMB > loggedMB) {
            loggedMB = receivedMB;
            console.log(`📊 Received: ${receivedMB}MB`);
        }
    });

    req.on('end', async () => {
        writeStream.end();
        console.log(`✅ Upload complete. Total size: ${(receivedBytes / (1024 * 1024)).toFixed(2)}MB`);

        try {
            const result = await uploadToTeraBox(filePath, req.headers['filename'] || 'uploaded_file');

            if (!result.success) {
                console.error("❌ Upload failed:", result.error);
                return res.status(500).json({ success: false, message: result.error || "Upload failed." });
            }

            res.json(result);
        } catch (error) {
            console.error("❌ Server error:", error);
            res.status(500).json({ success: false, message: "Internal server error." });
        }
    });

    req.on('error', (err) => {
        console.error("❌ Upload error:", err);
        res.status(500).json({ success: false, message: "Upload interrupted." });
    });
});
app.get('/download', async (req, res) => {
    const { filename } = req.query;
    if (!filename) {
        return res.status(400).json({ success: false, message: "Filename is required." });
    }

    try {
        console.log(`🔍 Searching for file: ${filename}`);
        const browser = await puppeteer.launch({
            headless: 'new',  // Use 'new' for improved headless mode
            protocolTimeout: 180000, // Increased protocol timeout for stability
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, // Use default if not set
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-features=IsolateOrigins,site-per-process', // More stable site isolation
                '--disable-web-security',
                '--disable-http2', // Disable HTTP/2 if causing issues
                '--proxy-server="direct://"',
                '--proxy-bypass-list=*',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-accelerated-2d-canvas',
                '--disable-ipc-flooding-protection',
                '--enable-features=NetworkService,NetworkServiceInProcess',
            ],
            ignoreDefaultArgs: ['--disable-extensions'], // Allow extensions if needed
            defaultViewport: null, // Avoid viewport resizing issues
        });
        const page = await browser.newPage();

        // Load cookies if available
        if (fs.existsSync(COOKIES_PATH)) {
            const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
            await page.setCookie(...cookies);
        }

        await page.goto(`https://www.terabox.com/main?category=all&search=${encodeURIComponent(filename)}`, { waitUntil: 'domcontentloaded' });

        const firstRowSelector = 'tbody tr:first-child';
        await page.waitForSelector(firstRowSelector, { visible: true, timeout: 30000 });
        await page.click(firstRowSelector);
        console.log("✅ Selected first row");

        const checkboxSelector = 'tbody tr:first-child .wp-s-pan-table__body-row--checkbox-block.is-select';
        await page.waitForSelector(checkboxSelector, { visible: true });
        await page.click(checkboxSelector);
        console.log("✅ Selected checkbox");

        const downloadButtonSelector = '.u-button-group.wp-s-agile-tool-bar__h-button-group.is-list.is-has-more div:nth-child(2)';
        await page.waitForSelector(downloadButtonSelector, { visible: true });

        // Intercept network requests to detect the file download URL
        let downloadLink = null;

        const waitForDownloadLink = new Promise((resolve) => {
            page.on('response', async (response) => {
                const url = response.url();
                if (url.startsWith("https://d-jp02-zen.terabox.com/file/")) {
                    downloadLink = url;
                    console.log(`🔗 Captured download link: ${downloadLink}`);
                    resolve();
                }
            });
        });

        await page.click(downloadButtonSelector);
        console.log("⬇️ Clicked second download button");

        // Wait until the network captures the download link
        await waitForDownloadLink;

        await browser.close();

        if (downloadLink) {
            res.json({ success: true, downloadLink });
        } else {
            res.status(500).json({ success: false, message: "Failed to capture download link." });
        }
    } catch (error) {
        console.error("❌ Download error:", error);
        res.status(500).json({ success: false, message: "Failed to retrieve download link." });
    }
});


const server = app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
server.timeout = 600000; // 10 minutes
server.headersTimeout = 650000; // Increase header timeout

