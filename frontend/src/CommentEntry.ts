import env from "../../env"
// @ts-ignore
import EventEmitter from "reactjs-eventemitter";
import { findFirstHyperlink } from "./CommentUtil";

export default class CommentEntry {
    id: number
    parent: number | null
    children: CommentEntry[]
    posted: number
    updated: number
    comment: string
    flagged: boolean
    name: string | null
    visitorid: number
    blocked: boolean
    thumbTitle: string | null
    thumbImg: string | null
    thumbLink: string | null

    constructor(row:any) {
        this.id = row.id;
        this.parent = row.parent;
        this.posted = Number.parseInt(row.posted);
        this.updated = Number.parseInt(row.updated);
        this.comment = row.comment;
        this.flagged = row.flagged;
        this.name = row.name;
        this.visitorid = row.visitorid;
        this.blocked = row.blocked;
        this.thumbImg = row.thumbnail;
        this.thumbTitle = row.thumbtitle;
        this.thumbLink = findFirstHyperlink(row.comment);

        this.children = [];
    };

    update(target: CommentEntry) {
        this.updated = target.updated;
        this.comment = target.comment;
        this.name = target.name;
    }
}

export class CommentCountInfo {
    min: number
    count: number

    constructor(row:any) {
        this.min = row.min;
        this.count = row.count;
    }
};

export class CommentEntries {
    newest = 0;
    map = new Map<number, CommentEntry>()
    tree:CommentEntry[] = [];
    count = 0;
    oldest = Number.MAX_VALUE;
    oldestLoaded = Number.MAX_VALUE;

    url: string = "";
    postid: number = 0;
    adminToken: string | null = null;
    apiToken: string | null = null;

    constructor(url: string) {
        this.url = url;
    }

    reset() {
        this.newest = 0;
        this.map = new Map<number, CommentEntry>()
        this.tree = [];
        this.count = 0;
        this.oldest = Number.MAX_VALUE;
        this.oldestLoaded = Number.MAX_VALUE;
    }

    private async parseComments(data: Response): Promise<CommentEntry[]> {
        const json = await data.json();

        const ret: CommentEntry[] = [];
        for (let item of json) {
            if (item) {
                ret.push(new CommentEntry(item));
            }
        }

        return ret;
    }

    private async parseCounts(data: Response): Promise<CommentCountInfo> {
        const json = await data.json();
        const ret = new CommentCountInfo(json);

        return ret;
    }

    private async parseComment(data: Response): Promise<CommentEntry> {
        const json = await data.json();
        return new CommentEntry(json);
    }

    async sortTree() {
        this.tree = [];
        for (let id of this.map.keys()) {
            const comment = this.map.get(id);
            if (!comment) { continue; }

            if (!comment.parent) {
                if (this.tree.findIndex((c) => {return c.id == comment.id}) == -1) {
                    this.tree.push(comment);
                }
                continue;
            }

            if (!this.map.has(comment.parent)) {
                const url = env.api + "/comment/" + comment.parent + "/" + this.apiToken;
                const res = await fetch(url);
                const parent = await this.parseComment(res);

                if (parent) {
                    this.map.set(parent.id, parent);
                }
            }

            const parent = this.map.get(comment.parent);
            if (parent) {
                if (parent.children.findIndex((c) => {return c.id == comment.id}) == -1) {
                    parent.children.push(comment);
                }
            }
        }

        this.tree = this.tree.sort((a, b) => { return b.posted - a.posted})
    }

    async getCounts() {
        try {
            const url = env.api + "/comments/" + this.postid + "/count";
            const json = await fetch(url);
            const obj = await this.parseCounts(json);

            this.oldest = obj.min;
            this.count = obj.count;
        } catch (err) {
            console.log("failed to fetch comment counts " + JSON.stringify(err));
            throw(err);
        }
    }

    async getRecent() {
        if (!this.apiToken) { return []}
        return this.getComments(env.api + "/comments/" + this.postid + "/all/" + this.apiToken);
    }

    async getFrom(from: number) {
        if (!this.apiToken) { return []}
        return this.getComments(env.api + "/comments/" + this.postid + "/after/" + from + "/" + this.apiToken);
    }

    async getNewest() {
        if (!this.apiToken) { return []}
        return this.getComments(env.api + "/comments/" + this.postid + "/after/" + this.newest + "/" + this.apiToken);
    }

    async getOlder() {
        if (!this.apiToken) { return []}
        return this.getComments(env.api + "/comments/" + this.postid + "/before/" + this.oldestLoaded + "/" + this.apiToken);
    }

    async updateComment(id:number) {
        const url = env.api + "/comment/" + id;
        const json = await fetch(url);
        const data = await json.json();
        const comment = new CommentEntry(data);
        
        if (this.map.has(comment.id)) {
            this.map.set(comment.id, comment);
        }

        const oldComment = this.map.get(comment.id);
        oldComment?.update(comment);
        EventEmitter.dispatch("commentUpdated", {id: comment.id});
    }

    async getComments(url:string) {
        try {
            if (this.count == 0) {
                this.getCounts();
            }

                
            const json = await fetch(url);
            const comments = await this.parseComments(json);

            if (this.tree.length == 0) {
                this.map.clear();
            }

            for (let comment of comments) {
                this.map.set(comment.id, comment);

                if (comment.updated > this.newest) {
                    this.newest = comment.updated;
                }

                if (comment.updated < this.oldestLoaded) {
                    this.oldestLoaded = comment.updated;
                }
            }
        } catch (err) {
            console.log("failed to fetch recent comments " + JSON.stringify(err));
        }
    }

    async getAllowPosts(): Promise<boolean> {
        try {
            const url = env.api + "/allowPosts";
            const json = await fetch(url);
            const data = await json.json();
            return data;
        } catch (err) {
            return true;
        }
    }

    async setAllowPosts(value: boolean) {
        try {
            const url = env.api + "/allowPosts/" + this.adminToken;
            const body = JSON.stringify({ allowPosts: value });
            await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body
            });
        } catch (err) {}
    }

    async getPost() {
        try {
            const enc = btoa(this.url);
            let url = env.api + "/post/" + enc;
            let json = await fetch(url);
            let data = await json.json();
            
            if (!data.id) {
                url = env.api + "/post";
                const body = JSON.stringify({url: this.url});
                json = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: body
                });
                
                data = await json.json();
            }

            this.postid = Number.parseInt(data.id);
        } catch (err) {
            console.log("failed to fetch post data " + JSON.stringify(err));
            this.postid = 0;
        }
    }

    async deletePost(id: number): Promise<number> {
        try {
            const url = env.api + "/comment/" + id + "/" + this.adminToken;
            const resp = await fetch(url, {
                method: 'DELETE',
                credentials: "include"
            });
            return resp.status;
        } catch (err) {
            console.log("failed to delete post entry " + JSON.stringify(err));
        }

        return 0;
    }

    async flagPost(id: number) {
        try {
            const url = env.api + "/comment/flag/" + id + "/" + this.adminToken;
            await fetch(url, {
                credentials: "include"
            });
        } catch (err) {
            console.log("failed to flag post entry " + JSON.stringify(err));
        }
    }
}
