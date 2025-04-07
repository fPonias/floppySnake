import express, { response } from 'express';
import { 
    getRecentComments, 
    createComment, 
    getComment, 
    deleteComment, 
    getCommentCount, 
    getOlderComments, 
    getTopComments, 
    getPost, 
    createPost 
} from './database';
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

function getStatic(file, res) {
    console.log("static " + file + " called")
    const pth = path.join("./dist/", file) 
    fs.readFile(pth, (err, data) => {
        if (err) {
            res.status(500).send(err);
            return;
        }

        let contentType = "";
        if (file.endsWith(".html")) {
            contentType = "text/html; charset=utf-8";
        } else if (file.endsWith(".js")) {
            contentType = "text/javascript; charset=utf-8";
        } else if (file.endsWith(".css")) {
            contentType = "text/css; charset=utf-8";
        }

        res.setHeader("Content-Type", contentType);
        res.status(200).send(data)
    })
}

app.get('/', (req, res) => {
    console.log("static / called")
    getStatic('/index.html', res);
});

app.get('', (req, res) => {
    console.log("static '' called")
    getStatic('/index.html', res);
});

app.get('/index.html', (req, res) => {
    console.log("static /index.html called")
    getStatic('/index.html', res);
});

function findFirst(suffix, res) {
    const pth = path.join("./dist/assets");
    try {
        fs.opendir(pth, (err, dir) => {
            let entry;
            while ((entry = dir.readSync()) != null) {
                if (entry.name.endsWith(suffix)) {
                    getStatic("assets/" + entry.name, res);
                    return;
                }
            };

            res.status(500).send(err);
        })
    } catch (err) {
        res.status(500).send(err);
    }
}

app.get('/floppySnake.js', (req, res) => {
    console.log("static /floppySnake.js called")
    findFirst(".js", res);
});

app.get('/floppySnake.css', (req, res) => {
    console.log("static /floppySnake.css called")
    findFirst(".css", res)
})

app.get('/comment/:postid', (req, res) => {
    console.log("get comment called with " + JSON.stringify(req.body));
    getTopComments(req.params.postid)
        .then(response => {
            res.status(200).send(response);
        })
        .catch(error => {
            res.status(500).send(error);
        })
})

app.get('/comment/:postid/before/:before', (req, res) => {
    console.log("get comment before called with " + JSON.stringify(req.params));
    getOlderComments(req.params.postid, req.params.before)
        .then(response => {
            res.status(200).send(response);
        })
        .catch(error => {
            res.status(500).send(error);
        })
})

app.get('/comment/:postid/count', (req, res) => {
    console.log("get comment count called");
    getCommentCount(req.params.postid)
        .then(response => {
            res.status(200).send(response);
        })
        .catch(error => {
            res.status(500).send(error);
        })
})

app.get('/comment/:postid/after/:after', (req, res) => {
    console.log("get comment after called with " + JSON.stringify(req.params));
    getRecentComments(req.params.postid, req.params.after)
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
    const postid = json.postid ?? 0;

    createComment(comment, name, ip, postid, parent)
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

app.get('/post/:url', (req, res) => {
    console.log("get post called with " + JSON.stringify(req.params));
    const url = atob(req.params.url);
    getPost(url)
        .then(response => {
            res.status(200).send(JSON.stringify({id: response}));
        })
        .catch(error => {
            res.status(500).send(error);
        })
});

app.post('/post', (req, res) => {
    console.log("post create called with " + JSON.stringify(req.body));

    const json = req.body;
    if (!json.url) {
        console.log("post url empty.");
        res.status(500).send();
        return;
    }


    createPost(json.url)
        .then(response => {
            res.status(200).send(JSON.stringify({ id: response }));
        })
        .catch(error => {
            console.log("post create failed with " + JSON.stringify(error));
            res.status(500).send(error);
        })
})

app.listen(env.port, () => {
    console.log(`App running on port ${env.port}.`)
})
