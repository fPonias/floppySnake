import express, { response } from 'express';
import { getRecentComments, createComment, getComment, deleteComment } from './database.ts';
const app = express()
const port = 3003

app.use(express.json())

app.use(express.static('dist'))

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers');
    next();
});

app.get('/', (req, res) => {
    getRecentComments()
        .then(response => {
            res.status(200).send(response);
        })
        .catch(error => {
            res.status(500).send(error);
        })
})

app.get('/comment/after/:after', (req, res) => {
    getRecentComments(req.params.after)
        .then(response => {
            res.status(200).send(response);
        })
        .catch(error => {
            res.status(500).send(error);
        })
})

app.get('/comment/:id', (req, res) => {
    console.log("get comment called with " + JSON.stringify(req.body));
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

app.listen(port, () => {
    console.log(`App running on port ${port}.`)
})