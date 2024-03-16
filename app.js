//* initialize variables
let debugMode;
let accounts;
let restartBots = false;
let webservice;
let page;
let launchOptions = {
    defaultViewport: null,
    timeout: 60000,
    slowMo: 20,
    args: ['--disable-notifications', '--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote']
};
const defaultViewport = {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1
};
let waitUntilLoading = {timeout: 60000};
const timeoutTimer = 180000;


//* setup dependencies
const path = require('path');
const fs = require('fs');
require("dotenv").config();
let puppeteer;
try {
    puppeteer = require('puppeteer');
    waitUntilLoading.waitUntil = 'networkidle2';
    if(process.env.NODE_ENV === 'production') launchOptions.executablePath=process.env.PUPPETEER_EXECUTABLE_PATH;
} catch (error) {
    puppeteer = require('puppeteer-core');
    waitUntilLoading.waitUntil = 'load';
    launchOptions.executablePath = '/usr/bin/chromium-browser';
}
const {
    convertJsonFileToMap,
    waitForTimeout,
    log,
    randomNumber,
} = require('./baseFunctions');


function setSettings(mode, accs, webs = false) {
    debugMode = mode;
    accounts = accs;
    webservice = webs;
}


async function startBot(email) {
    launchOptions.headless = !debugMode;
    // launchOptions.headless = false,

    let browser;
    try {
        browser = await puppeteer.launch(launchOptions);
        if(!webservice) await waitForTimeout(randomNumber(1,10000));
        await pageLogin(browser, email);

        await startAutoAction(browser, email);
    } catch (error) {
        log(("error starting bot: "+ error), email, "error")
        if(browser.isConnected()){
            await browser.close();
        }
    }
}

//* Browser Functions
async function pageLogin(browser, email){
    page = null;
    let dropPromise = false;
    try {
        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(async () => {
                if(!dropPromise){
                    dropPromise = true;
                    reject(new Error('Function execution timed out (pageLogin took longer than 3 minutes)'));
                    //if(browser.isConnected()) await browser.close();
                    restartBots = true;
                }
            }, timeoutTimer);
        });
        const postPromise = (async () => {
            while(!dropPromise){
                page = await browser.newPage()
                await pageSettings(page)
                await page.goto('https://beta.out.app/');
                dropPromise = true;
            }
        })();
        await Promise.race([timeoutPromise, postPromise])

        await page.waitForSelector('#email', { visible: true, timeout: 60000 });
        await page.type('#email', email);

        await page.waitForSelector('#input-group-1', { visible: true, timeout: 20000 });
        await page.type('#input-group-1', accounts.get(email).get('password'));
            

        await page.waitForSelector('button[type="submit"]', { visible: true, timeout: 20000 });
        await page.click('button[type="submit"]');

        log("login successfull", email, "")

        await waitForTimeout(4000);

    } catch (error) {
        const stackTrace = error + "\n" + error.stack
        log(('Error occurred while logging in: '+ stackTrace), email, "error");
    } finally {
        if(page){
            //await page.close();
        }
    }
}

async function startAutoAction(browser, email){
    try {
        while (browser.isConnected()) {
            // random delay
            if(!webservice){
                let randomInt = randomNumber(accounts.get(email).get('waitMin'), accounts.get(email).get('waitMax'));

                if (debugMode) {
                    log(("sleeping for: [" + randomInt + " sec] scheduling next action..."), email);
                } else {
                    log(("sleeping for: [" + randomInt + " min] scheduling next action..."), email);
                    randomInt *= 60;
                }
                await waitForTimeout(randomInt * 1000);
            }

            await autoAction(browser, email);

            if(restartBots || webservice) await browser.close()
        }
    } catch (error) {
        const stackTrace = error + "\n" + error.stack
        log(('Error occurred while starting auto action: ' + stackTrace), "", "error");

        await waitForTimeout(5000);
    }
}

async function autoAction(browser, email){
    try {
        const result = randomAction(email);
        switch (result) {
            case 'newPost':
                let postText 
                if(accounts.get(email).get('postText') == true){
                    postText = await randomLineFromTextFile(email)
                    
                    log(("posting text: "+ postText), email)
                }

                let img;
                if(accounts.get(email).get('postImages') == true){
                    img = await randomImageFromFolder(email);

                    log(("posting image: "+ postText), email)
                }

                await newPost(browser, email, postText, img);
                break;
            case 'rePost':
                log("reposting", email)
                await rePost(browser, email);
                break;
            case 'likePost':
                log("liking post", email)
                await likePost(browser, email);
                break;
            default:
                throw new Error('Invalid result while choosing random action');
        }
    } catch (error) {
        const stackTrace = error + "\n" + error.stack
        log(('Error occurred while performing auto action: '+ stackTrace), email, "error");
    }
}


//* Actions
async function newPost(browser, email, text = null, img = null){
    //let page = null;
    let dropPromise = false;
    try {
        if(!(text || img)) {
            throw new Error('no text or image specified');
        }

        if(page.url() != 'https://beta.out.app/dashboard/home/'){
            const timeoutPromise = new Promise((resolve, reject) => {
                setTimeout(async () => {
                    if(!dropPromise){
                        dropPromise = true;
                        reject(new Error('Function execution timed out (newPage took longer than 3 minutes)'));
                        //if(browser.isConnected()) await browser.close();
                        restartBots = true;
                    }
                }, timeoutTimer);
            });
            const postPromise = (async () => {
                while(!dropPromise){
                    page = await browser.newPage()
                    await pageSettings(page)
                    await page.goto('https://beta.out.app/dashboard/home/');
                    dropPromise = true;
                }
            })();
            await Promise.race([timeoutPromise, postPromise]);
        }
            

        if(text){
            await page.waitForSelector('#editor', { visible: true, timeout: 60000 });
            await waitForTimeout(1000)
            await page.type('#editor', text);
            await waitForTimeout(300);
        }

        if(img){
            await page.waitForSelector('button.items-start.justify-start', { visible: true, timeout: 60000 });
            await waitForTimeout(1000)
            const [fileChooser] = await Promise.all([
                page.waitForFileChooser(),
                page.click('button.items-start.justify-start')
            ]);

            await fileChooser.accept([img])
            await waitForTimeout(300);
        }

        if(!debugMode){
            await page.waitForSelector('button[type="submit"]', { visible: true, timeout: 20000 });
            await page.click('button[type="submit"]');
            await waitForTimeout(2000)
        }

        log("action completed successfully", email, "")
    
    } catch (error) {
        const stackTrace = error + "\n" + error.stack
        log(('Error occurred during newPost: '+ stackTrace), email, "error");
    } finally {
        if (page) {
            await page.close();
        }
    }
}

async function rePost(browser, email){
    // let page = null;
    let dropPromise = false;
    try {
        if(page.url() != 'https://beta.out.app/dashboard/home/'){
            const timeoutPromise = new Promise((resolve, reject) => {
                setTimeout(async () => {
                    if(!dropPromise){
                        dropPromise = true;
                        reject(new Error('Function execution timed out (rePost took longer than 3 minutes)'));
                        //if(browser.isConnected()) await browser.close();
                        restartBots = true;
                    }
                }, timeoutTimer);
            });
            const postPromise = (async () => {
                while(!dropPromise){
                    page = await browser.newPage()
                    await pageSettings(page)
                    await page.goto('https://beta.out.app/dashboard/home/');
                    dropPromise = true;
                }
            })();
            await Promise.race([timeoutPromise, postPromise]);
        }


        await page.waitForSelector('.flex.items-start.gap-4.pt-3', { visible: true, timeout: 60000 });
        const elements = await page.$$('.flex.items-start.gap-4.pt-3');

        await waitForTimeout(1000)

        if(elements.length > 0){
            const thirdChild = await elements[0].$(':nth-child(3)');
            if(thirdChild){
                await thirdChild.click();
        
                if (!debugMode) {
                    await page.evaluate(async () => {
                        const repostButton = await document.querySelector('.repost-dot-menu');
                        if (repostButton){
                            await repostButton.click();
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        } else throw new Error('repost button not found');
                    });
                }
            } else throw new Error('repost menu not found');
        } else throw new Error('no posts found');

        log("action completed successfully", email, "")

    } catch (error) {
        const stackTrace = error + "\n" + error.stack
        log(('Error occurred during reposting: '+ stackTrace), email, "error");
    } finally {
        if (page) {
            await page.close();
        }
    }
}

async function likePost(browser, email){
    // let page = null;
    let dropPromise = false;
    try {
        if(page.url() != 'https://beta.out.app/dashboard/home/'){
            const timeoutPromise = new Promise((resolve, reject) => {
                setTimeout(async () => {
                    if(!dropPromise){
                        dropPromise = true;
                        reject(new Error('Function execution timed out (likePost took longer than 3 minutes)'));
                        //if(browser.isConnected()) await browser.close();
                        restartBots = true;
                    }
                }, timeoutTimer);
            });
            const postPromise = (async () => {
                while(!dropPromise){
                    page = await browser.newPage()
                    await pageSettings(page)
                    await page.goto('https://beta.out.app/dashboard/home/');
                    dropPromise = true;
                }
            })();
            await Promise.race([timeoutPromise, postPromise]);
        }


        await page.waitForSelector('.flex.items-start.gap-4.pt-3', { visible: true, timeout: 60000 });
        const elements = await page.$$('.flex.items-start.gap-4.pt-3');

        await waitForTimeout(1000)

        if(elements.length > 0){
            if (!debugMode) {
                const element = elements[0]
                await page.evaluate(async (element) => {
                    const likeButton = await element.querySelector(':nth-child(1)');
                    if (likeButton) {
                        await likeButton.click();
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } else throw new Error('like button not found');
                }, element);
            }
        } else throw new Error('no posts found');

        log("action completed successfully", email, "")

    } catch (error) {
        const stackTrace = error + "\n" + error.stack
        log(('Error occurred during liking: '+ stackTrace), email, "error");
    } finally {
        if (page) {
            await page.close();
        }
    }
}


//* Functionality
function randomAction(email){
    if(accounts.get(email).get("doActionCycle") == true){
        if(!accounts.get(email).has("currentCycle")){
            //create array
            accounts.get(email).set("currentCycle", []);
        }

        if((accounts.get(email).get("currentCycle")).length === 0){
            // fill the currentCycle
            const categories = ['newPost', 'rePost', 'likePost'];
            let cycleArray = [];

            categories.forEach(category => {
                const weight = accounts.get(email).get("actionWeight").get(category);
                
                for (let i = 0; i < weight; i++) {
                    cycleArray.push(category);
                }
            });
            accounts.get(email).set("currentCycle", cycleArray);
        }
        let currentCycle = accounts.get(email).get("currentCycle");
        
        const randomIndex = randomNumber(0, currentCycle.length - 1);
        const removedElement = currentCycle.splice(randomIndex, 1)[0];

        accounts.get(email).set("currentCycle", currentCycle);
        return removedElement;
    } else {
        const newPost = accounts.get(email).get("actionWeight").get("newPost");
        const rePost = accounts.get(email).get("actionWeight").get("rePost");
        const likePost = accounts.get(email).get("actionWeight").get("likePost");

        let number = randomNumber(1, (newPost + rePost + likePost))

        if(number <= newPost) return 'newPost'
        if(number <= newPost+rePost) return 'rePost'
        return 'likePost'
    }
}

async function randomLineFromTextFile(email) {
    let fileName = accounts.get(email).get('fileName')
    let filePath = `${__dirname}/data/text/${fileName}.txt`

    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

    if (lines.length <= 1) {
        log(("RETURNING: file "+ fileName +' is (almost) empty'), email, "warn")
        return
    }

    // get random line
    const randomIndex = Math.floor(Math.random() * lines.length);
    const randomLine = lines[randomIndex];

    // remove line
    if(!debugMode && accounts.get(email).get('deleteTextLines') == true){
        lines.splice(randomIndex, 1);
        await fs.writeFileSync(filePath, lines.join('\n'));
    }

    return randomLine;
}

async function randomImageFromFolder(email) {
    let fileName = accounts.get(email).get('fileName');
    let folderPath = `${__dirname}/data/images/${fileName}`;

    // Check if 1temp image exists and delete it
    const tempImagePath = path.join(folderPath, '1temp.png');
    if (fs.existsSync(tempImagePath)) {
        fs.unlinkSync(tempImagePath);
    }

    // Read the list of files in the folder
    const files = fs.readdirSync(folderPath);

    if (files.length <= 0) {
        log(("RETURNING: Folder " + fileName + " is empty"), email, "warn");
        return;
    }

    // Get a random image file
    const randomIndex = Math.floor(Math.random() * files.length);
    const randomImage = files[randomIndex];

    // Construct the path to the random image
    const imagePath = path.join(folderPath, randomImage);
    let tempImageNewPath;

    if(!debugMode && accounts.get(email).get('deleteImageFiles') == true){
        tempImageNewPath = path.join(folderPath, '1temp.png');
        fs.renameSync(imagePath, tempImageNewPath);   
    } else {
        tempImageNewPath = imagePath;
    }

    return tempImageNewPath;
}

async function pageSettings(page){
    try {
        if(page){
            await page.setViewport(defaultViewport);
            await page.setRequestInterception(true);


            page.on('request', (req) => {
                    const resourceType = req.resourceType();
                    if (resourceType === 'image' || resourceType === 'video') {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });
        }
    } catch (error) {
        const stackTrace = error + "\n" + error.stack
        log(('Error occurred while setting up page: '+ stackTrace), "", "error");
    }
}


module.exports = {
    setSettings,
    startBot
};