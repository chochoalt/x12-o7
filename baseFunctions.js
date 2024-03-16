const fs = require('fs');


// common functions
function convertJsonFileToJsonObject(filePath) {
    const fs = require('fs');
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return json;
}

function convertJsonFileToMap(filePath) {
    const fs = require('fs');
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const map = jsonToMap(json);
    return map;
}

function jsonToMap(json) {
    if (typeof json !== 'object' || json === null) {
        return json;
    }
    
    if (Array.isArray(json)) {
        return json.map(element => jsonToMap(element));
    }
    
    const map = new Map();
    Object.keys(json).forEach(key => {
        map.set(key, jsonToMap(json[key]));
    });
    return map;
}

async function waitForTimeout(time){
    try {
        await new Promise(resolve => setTimeout(resolve, time));
    } catch (error) {
        log("an error occured while waiting for a timeout", "", "error")
    }
}

function log(text, email = "", type = "") {
    let timeStamp = new Date();

    let logText = "["+timeStamp.toLocaleTimeString('en-US', {hour12: false})+"] "

    if(type == "warn") {
        logText += "[WARN] "
    } else if(type == "error") {
        logText += "[ERROR] "
    }

    if(email){
        logText += email+" > ";
    }

    logText += text;

    if(type == "warn") {
        console.warn(logText)
    } else if(type == "error") {
        console.error(logText)
    } else {
        console.log(logText)
    }
}

function randomNumber(min, max){
    if(min <= max){
        min = Math.ceil(min);
        max = Math.floor(max);

        return Math.floor(Math.random() * (max - min + 1)) + min;
    } else return 10
}

// export the functions
module.exports = {
    convertJsonFileToJsonObject,
    convertJsonFileToMap,
    jsonToMap,
    waitForTimeout,
    log,
    randomNumber
};