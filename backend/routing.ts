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
    flagComment,
    getUserData,
    getAlias,
    updateAlias,
    getFilterList,
    addFilter,
    updateFilter,
    deleteFilter
} from './database';
import MyWebSocket from './websocket'; 
import env2 from '../env';
import { authorize, isAuthorized } from './adminKey';
import { filterString } from './filter';

const env = (env2.default) ? env2.default : env2;
let allowPosts = true;

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

    app.get('/img/:file', (req, res, next) => {
        const file = req.params.file
        console.log("static /img/" + file + " called")
        const pth = path.join("./img/", file)
        fs.readFile(pth, (err, data) => {
            if (err) {
                res.status(500).send(err);
                return;
            }

            let contentType = "";
            if (file.endsWith(".jpg")) {
                contentType = "image/jpeg";
            } 

            res.setHeader("Content-Type", contentType);
            res.status(200).send(data)
        })
    });

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

        if (!allowPosts) { 
            res.status(500).send("nope");
        }

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

    app.post("/alias/:visitorid{/:token}", (req, res) => {
        console.log("post alias called with " + JSON.stringify(req.body));

        if (!isAuthorized(req)) {
            console.log("auth failed for delete action");
            res.status(401).send();
            return;
        }

        const json = req.body;
        if (json.alias === undefined) {
            console.log("post alias empty.");
            res.status(500).send();
            return;
        }

        updateAlias(req.params.visitorid, json.alias)
            .then(response => {
                res.status(200).send("success");

                if (response != null) {
                    MyWebSocket.instance.broadcastUpdateAlias(response, req.params.visitorid);
                }
            })
            .catch(error => {
                res.status(500).send(error);
            })
    });

    app.get("/alias{/:after}", (req, res) => {
        console.log("alias fetch called with" + JSON.stringify(req.params));
        
        getAlias(req.params.after ?? 0)
            .then(response => {
                res.status(200).send(response)
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

    app.get('/getAdmin/:key/:token', (req, res) => {
        console.log("getAdmin called with " + JSON.stringify(req.params));

        if (!MyWebSocket.instance.isLoggedIn(req.params.token)) {
            console.log("invalid user attempted to get admin token");
            res.status(500).send("nope");
            return;
        }

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
    });

    app.get('/userData/:key', (req, res) => {
        console.log("userData called with " + JSON.stringify(req.params));
        const key = req.params.key;

        if (!isAuthorized(key)) {
            console.log("auth request rejected with " + key);
            res.status(500).send("nope");
            return;
        }

        getUserData()
            .then(userData => {
                MyWebSocket.instance.markActiveUsers(userData);
                res.status(200).send(JSON.stringify(userData));
            })
            .catch(error => {
                console.log("get user data failed with " + JSON.stringify(error));
                res.status(500).send(error);
            });
    })

    app.get("/allowPosts", (req, res) => {
        res.status(200).send(allowPosts ? "true" : "false");
    })

    app.post("/allowPosts{/:token}", (req, res) => {
        console.log("set allow posts called");
        if (!isAuthorized(req)) {
            console.log("auth failed for allowPost action");
            res.status(401).send();
            return;
        }

        const json = req.body;
        if (json.allowPosts === undefined) {
            console.log("post allowPosts empty.");
            res.status(500).send();
            return;
        }

        allowPosts = json.allowPosts;
        console.log("allow posts set to " + allowPosts);

        res.status(200).send(allowPosts ? "true" : "false");
        MyWebSocket.instance.broadcastAllowPosts(allowPosts);
    })

    app.get("/filter{/:token}", (req, res) => {
        console.log("get filters called");
        if (!isAuthorized(req)) {
            console.log("auth failed");
            res.status(401).send();
            return;
        }

        getFilterList().then(ret => {
            res.status(200).send(ret);
        }).catch(err => {
            console.log("get filters failed with " + err);
            res.status(500).send("nope");
            return;
        });
    });

    app.post("/filter{/:token}", (req, res) => {
        console.log("update filters called");

        if (!isAuthorized(req)) {
            console.log("auth failed");
            res.status(401).send();
            return;
        }

        const json = req.body;
        if (json.id === undefined) {
            addFilter(json).then(() => {
                res.status(200).send("success");
            }).catch(err => {
                console.log("add filter failed with " + err);
                res.status(500).send("nope");
                return;
            })
        } else {
            updateFilter(json).then(() => {
                res.status(200).send("success");
            }).catch(err => {
                console.log("update filter failed with " + err);
                res.status(500).send("nope");
                return;
            })
        }

        MyWebSocket.instance.broadcastFiltersUpdated();
    });

    app.delete("/filter/:id{/:token}", (req, res) => {
        console.log("delete filter called");

        if (!isAuthorized(req)) {
            console.log("auth failed");
            res.status(401).send();
            return;
        }

        deleteFilter(req.params.id).then(() => {
            res.status(200).send("success");
        }).catch(err => {
            console.log("delete filter failed with" + err);
            res.status(500).send("nope");
            return
        })

        MyWebSocket.instance.broadcastFiltersUpdated();
    })
}
