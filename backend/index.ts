import express, { response } from 'express';
import { getRecentComments, createComment, getComment, deleteComment, getCommentCount, getOlderComments, getTopComments } from './database';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import https from 'https';
import env2 from '../env';

const env = (env2.default) ? env2.default : env2;

console.log("env: " + JSON.stringify(env));

const app = express()

const options = {
    key: fs.readFileSync(env.sslPrivate),
    cert: fs.readFileSync(env.sslCert),
};

if (env.sslEnabled) {
    https.createServer(options, app).listen(env.port, function () {
        console.log("Express server listening on port " + env.port);
    });
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

app.use(express.static('dist'))

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers');
    next();
});

const wellKnownContent = `DCFED0EFA645CA8FE804941CE4DD4BC7F3CBA688DAFD88388C6122591BDDF88F
sectigo.com
67ef73c346636`;

app.get('/.well-known/pki-validation/1FDA0D95DDB3FBF952FEDFA2526D9F02.txt', (req, res) => {
	res.setHeader("Content-Type", "text/plain; charset=utf-8");
	res.status(200).send(wellKnownContent);
})

app.get('/comment', (req, res) => {
    console.log("get comment called with " + JSON.stringify(req.body));
    getTopComments()
        .then(response => {
            res.status(200).send(response);
        })
        .catch(error => {
            res.status(500).send(error);
        })
})

app.get('/comment/before/:before', (req, res) => {
    console.log("get comment before called with " + JSON.stringify(req.params));
    getOlderComments(req.params.before)
        .then(response => {
            res.status(200).send(response);
        })
        .catch(error => {
            res.status(500).send(error);
        })
})

app.get('/comment/count', (req, res) => {
    console.log("get comment count called");
    getCommentCount()
        .then(response => {
            res.status(200).send(response);
        })
        .catch(error => {
            res.status(500).send(error);
        })
})

app.get('/comment/after/:after', (req, res) => {
    console.log("get comment after called with " + JSON.stringify(req.params));
    getRecentComments(req.params.after)
        .then(response => {
            res.status(200).send(response);
        })
        .catch(error => {
            res.status(500).send(error);
        })
})

app.get('/comment/:id', (req, res) => {
    console.log("get comment called with " + JSON.stringify(req.params));
    getComment(req.params.id)
        .then(response => {
            res.status(200).send(response);
        })
        .catch(error => {
            res.status(500).send(error);
        })
});

app.post('/comment', (req, res) => {
    console.log("post comment called with " + JSON.stringify(req.body));

    const json = req.body;
    if (!json.comment) {
        console.log("post comment empty.");
        res.status(500).send();
        return;
    }

    const comment = json.comment.substring(0, 4096);
    const name = json.name ?? null;
    const parent = json.parent ?? null;
    const ip = "";

    createComment(comment, name, ip, parent)
        .then(response => {
            console.log("post comment successful");
            res.status(200).send(response);
        })
        .catch(error => {
            console.log("post comment failed with " + JSON.stringify(error));
            res.status(500).send(error);
        })
})

app.delete('/comment/:id', (req, res) => {
    deleteComment(req.params.id)
        .then(response => {
            res.status(200).send(response);
        })
        .catch(error => {
            res.status(500).send(error);
        })
})

app.listen(env.port, () => {
    console.log(`App running on port ${env.port}.`)
})
