import path from 'path';
import fs from 'fs';
import {
    getRecentComments,
    createComment,
    getComment,
    deleteComment,
    getCommentCount,
    getOlderComments,
    getTopComments,
    getPost,
    createPost,
    flagComment
} from './database';
import MyWebSocket from './websocket'; 
import env2 from '../env';
import { authorize, isAuthorized } from './adminKey';
import { filterString } from './filter';

const env = (env2.default) ? env2.default : env2;

export default function setupRouting(app:any) {
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

    app.get('/certificate.pem', (req, res) => {
        console.log("certificate called");
        fs.readFile(env.sslCert, (err, data) => {
            if (err) {
                res.status(500).send(err);
                return;
            }

            let contentType = "application/x-pem-file";
            res.setHeader("Content-Type", contentType);
            res.status(200).send(data)
        })
    })

    function findFirst(suffix, res) {
        const pth = path.join("./dist/assets");
        try {
            fs.opendir(pth, (err, dir) => {
                let entry;
                while ((entry = dir.readSync()) != null) {
                    if (entry.name.endsWith(suffix)) {
                        getStatic("assets/" + entry.name, res);
                        dir.closeSync();
                        return;
                    }
                };

                dir.closeSync();
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

    app.get(/\/assets\/index(.*)\.js/, (req, res, next) => {
        console.log("static /assets/index.js called")
        findFirst(".js", res);
    });

    app.get(/\/assets\/index(.*)\.css/, (req, res, next) => {
        console.log("static /assets/index.css called")
        findFirst(".css", res)
    })

    app.get('/comments/:postid', (req, res) => {
        console.log("get comments called with " + JSON.stringify(req.body));
        getTopComments(req.params.postid)
            .then(response => {
                res.status(200).send(response);
            })
            .catch(error => {
                res.status(500).send(error);
            })
    })

    app.get('/comments/:postid/before/:before', (req, res) => {
        console.log("get comment before called with " + JSON.stringify(req.params));
        getOlderComments(req.params.postid, req.params.before)
            .then(response => {
                res.status(200).send(response);
            })
            .catch(error => {
                res.status(500).send(error);
            })
    })

    app.get('/comments/:postid/count', (req, res) => {
        console.log("get comment count called");
        getCommentCount(req.params.postid)
            .then(response => {
                res.status(200).send(response);
            })
            .catch(error => {
                res.status(500).send(error);
            })
    })

    app.get('/comments/:postid/after/:after', (req, res) => {
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

    app.get('/comment/flag/:id{/:token}', (req, res) => {
        console.log("flag comment called with " + JSON.stringify(req.params));

        if (!isAuthorized(req)) {
            console.log("auth failed for flag action");
            res.status(401).send();
            return;
        }

        flagComment(req.params.id)
            .then(response => {
                if (!response) {
                    res.status(500).send("flag failed");
                } else {
                    res.status(200).send(response);
                    console.log("sending socket broadcast with id " + req.params.id + " and time " + response);
                    const id = Number.parseInt(req.params.id);

                    MyWebSocket.instance.broadcastUpdatePost(id);
                }
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

        let original = json.comment.substring(0, 4096);
        let name = json.name ?? null;
        const parent = json.parent ?? null;
        const postid = json.postid ?? 0;
        const now = new Date().getTime();
        const token = json.token

        name = filterString(name);
        const comment = filterString(original);
        if (original == comment) {
            original = "";
        } else {
            console.log("comment " + original + " filtered to " + comment);
        }

        createComment(token, comment, name, postid, parent, original)
            .then(response => {
                console.log("post comment successful");
                res.status(200).send(response);

                MyWebSocket.instance.broadcastNewPost(postid, now);
            })
            .catch(error => {
                console.log("post comment failed with " + JSON.stringify(error));
                res.status(500).send(error);
            })
    })

    app.delete('/comment/:id{/:token}', (req, res) => {
        console.log("delete post called with " + JSON.stringify(req.params));
        
        if (!isAuthorized(req)) {
            console.log("auth failed for delete action");
            res.status(401).send();
            return;
        }

        deleteComment(req.params.id)
            .then(response => {
                if (!response) {
                    res.status(500).send("delete failed");
                } else {
                    res.status(200).send(response);
                    console.log("sending socket broadcast with id " + req.params.id + " and time " + response);
                    const id = Number.parseInt(req.params.id);

                    MyWebSocket.instance.broadcastUpdatePost(id);
                }
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
                res.status(200).send(JSON.stringify({ id: response }));
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

    app.get('/getAdmin/:key', (req, res) => {
        console.log("getAdmin called with " + JSON.stringify(req.params));
        const key = req.params.key;

        const auth = authorize(key);

        if (auth == null) {
            console.log("auth request rejected with " + key);
            res.status(500).send("nope");
            return;
        }

        res.status(200).set({
            "Set-Cookie": "token=" + auth + "; HttpOnly; SameSite=Strict; Path=/;",
            "Access-Control-Allow-Credentials": "true",
        }).send(auth);
    })

    app.get('/isAdmin/:key', (req, res) => {
        console.log("isAdmin called with " + JSON.stringify(req.params));
        const key = req.params.key;

        const auth = isAuthorized(key);

        res.status(200).send(auth ? "true" : "false");
    })
}
