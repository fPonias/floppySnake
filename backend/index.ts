import express, { response } from 'express';
import {default as ws} from 'express-ws';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import cors from 'cors';
import env2 from '../env';
import setupRouting from './routing';
import MyWebSocket from './websocket';
import {WebSocketServer} from 'ws';
import { resetKey } from './adminKey';
import cookieParser from 'cookie-parser';
import { checkIp } from './database';

const env = (env2.default) ? env2.default : env2;

const app = express()
const expressWs = ws(app);

const options = {
    key: fs.readFileSync(env.sslPrivate),
    cert: fs.readFileSync(env.sslCert),
};

let server;
if (env.sslEnabled) {
    server = https.createServer(options, app);
} else {
    server = http.createServer(app);
}

app.use(express.json())

const now = new Date().getTime();
const today = Math.floor(now / (3600 * 24 * 1000));
// create a write stream (in append mode)
const fileName = 'access-' + today + '.log';
const accessLogStream = fs.createWriteStream(
    path.join("./logs/", fileName),
    { flags: 'a' }
)

// setup the logger
app.use(morgan('common', { stream: accessLogStream }));

const ipBlacklistFile = './ip-blacklist.txt';
let ipBlacklist: string[] = []
let ipFileSz = 0;
function reloadIpBlacklist() {
    try {
        const stats = fs.statSync(ipBlacklistFile);
        if (stats.size == ipFileSz) { return; }

        const data = fs.readFileSync(ipBlacklistFile, { encoding: 'utf8' });
        ipBlacklist = data.split('\n');
        ipFileSz = stats.size
        console.log("reloaded ip blacklist with " + ipBlacklist.length + " entries");
    } catch (err) {
        console.error(err);
    }
}

function isBlacklisted(ip: string): boolean {
    reloadIpBlacklist();
    const isIp4 = ip.startsWith("::ffff:");
    const ip4 = ip.substring(7);

    for (let prefix of ipBlacklist) {
        if (!isIp4 && ip.startsWith(prefix)) { return true; }
        else if (isIp4 && ip4.startsWith(prefix)) { return true; }
    }

    return false;
}

const ipSaver = async function (req, res, next) {
    await checkIp(req.ip);
    if (isBlacklisted(req.ip)) {
        console.log("banned user " + req.ip + " requested " + req.url);
        res.status(404).send("Banned");
        return;
    }

    next();
}


app.use(ipSaver);

app.use(cookieParser());
app.use(cors({
    origin: function (origin, callback) {
        callback(null, origin)
    },
    credentials: true,
}));

//setup auth keys
resetKey();

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader("Access-Control-Expose-Headers", "Set-Cookie");
    next();
});

setupRouting(app)


server.listen(env.port, () => {
    console.log(`App running on port ${env.port}.`)
})

const wss = new WebSocketServer({ server: server });
MyWebSocket.init(wss)
