const express = require("express")
const app = express();
const { setSettings, startBot } = require('./app')
const { jsonToMap, log } = require('./baseFunctions');

const PORT = process.env.PORT || 4000;

app.use(express.json()); 

app.get("/" , (req, res) => {
    log("server is up and running!")
    res.send("server is up and running!")
})

app.get("/ping" , (req, res) => {
    try {
        log("ping successfull!")
        res.json({ message: "ping successfull!" });
    } catch (error) {
        log(("unexpected errror occured on /ping: "+error), "", "error")
        res.status(500).json({ error: "Unexpected error occurred" });
    }
})

app.post("/bot" , async (req, res) => {
    try {
        //console.log('Received data:', req.body);

        let account = jsonToMap(req.body);
        if(!(account instanceof Map)) throw new Error('error with account map');
        const email = Object.keys(req.body)[0];
        const debugMode = account["debugMode"];

        // bot actions
        if(debugMode){log("set settings", email)}
        setSettings(debugMode, account, true)

        log("starting bot...", email)
        await startBot(email)

        // response
        res.json({ message: "Tasks completed successfully!" });
    } catch (error) {
        log(("unexpected errror occured on /bot: "+error), "", "error")
        res.status(500).json({ error: "Unexpected error occurred" });
    }
})

app.listen(PORT, () => {
    log(`listening on port ${PORT}`)
})