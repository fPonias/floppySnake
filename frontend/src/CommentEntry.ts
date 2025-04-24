import env from "../../env"

export default class CommentEntry {
    id: number
    parent: number | null
    children: CommentEntry[]
    posted: number
    updated: number
    comment: string
    name: string | null
    ip: string

    constructor(row:any) {
        this.id = row.id;
        this.parent = row.parent;
        this.posted = Number.parseInt(row.posted);
        this.updated = Number.parseInt(row.updated);
        this.comment = row.comment;
        this.ip = row.ip;
        this.name = row.name;

        this.children = [];
    };
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

    constructor(url: string) {
        this.url = url;
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
                const url = env.api + "/comment/" + comment.parent;
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
            const url = env.api + "/comment/" + this.postid + "/count";
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
        return this.getComments(env.api + "/comment/" + this.postid);
    }

    async getNewest() {
        return this.getComments(env.api + "/comment/" + this.postid + "/after/" + this.newest);
    }

    async getOlder() {
        return this.getComments(env.api + "/comment/" + this.postid + "/before/" + this.oldestLoaded);
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
                if (this.map.has(comment.id)) { continue; }

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

    async requestAdmin(key: string):Promise<string> {
        try {
            const url = env.api + "/getAdmin/" + key;
            const json = await fetch(url);
            const decoder = new TextDecoder();
            const arr = await json.bytes();
            const str = decoder.decode(arr);
            return str;
        } catch (err) {
            console.log("failed to obtain authorization " + JSON.stringify(err));
        }

        return "";
    }

    async verifyAdmin(token: string): Promise<boolean> {
        try {
            const url = env.api + "/isAdmin/" + token;

            const json = await fetch(url);
            const decoder = new TextDecoder();
            const arr = await json.bytes();
            const str = decoder.decode(arr);
            return (str == 'true') ? true : false;
        } catch (err) {
            console.log("failed to verify authorization " + JSON.stringify(err));
        }

        return false;
    }

    async deletePost(id: number) {
        try {
            const url = env.api + "/comment/" + id;
            await fetch(url, {
                method: 'DELETE',
                credentials: "include"
            });
        } catch (err) {
            console.log("failed to delete post entry " + JSON.stringify(err));
        }
    }
}
