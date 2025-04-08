import express, { response } from 'express';
import {default as ws} from 'express-ws';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import env2 from '../env';
import setupRouting from './routing';
import MyWebSocket from './websocket';

const env = (env2.default) ? env2.default : env2;

const app = express()
const expressWs = ws(app);

const options = {
    key: fs.readFileSync(env.sslPrivate),
    cert: fs.readFileSync(env.sslCert),
};

let server;
if (env.sslEnabled) {
    server = https.createServer(options, app)
} else {
    server = http.createServer({}, app);
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
app.use(morgan('common', { stream: accessLogStream }))

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers');
    next();
});

setupRouting(app)

app.ws('/', function (ws, req) {
    console.log("web socket root called");
})
const wss = expressWs.getWss();
MyWebSocket.init(wss);

app.listen(env.port, () => {
    console.log(`App running on port ${env.port}.`)
})