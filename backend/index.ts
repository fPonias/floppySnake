import express, { response } from 'express';
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

function createServer(port) {
    const options = {
        key: fs.readFileSync(env.sslPrivate),
        cert: fs.readFileSync(env.sslCert),
    };

    let server;
    if (env.sslEnabled) {
        server = https.createServer(options, app).listen(port, function () {
            console.log("Express server listening on port " + env.port);
        });
    } else {
        server = http.createServer();
    }

    return server;
}

const server = createServer(env.port);

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

app.listen(env.port, () => {
    console.log(`App running on port ${env.port}.`);
    MyWebSocket.init(server);
})

const wsServer = createServer(env.wsport);
MyWebSocket.init(wsServer);
