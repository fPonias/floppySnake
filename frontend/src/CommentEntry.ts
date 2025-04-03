import { api } from "./env"

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

export class CommentEntries {
    private static _instance:CommentEntries | null = null;

    static get instance():CommentEntries {
        if (!CommentEntries._instance) {
            CommentEntries._instance = new CommentEntries();
        }

        return CommentEntries._instance;
    }

    newest = 0;
    map = new Map<number, CommentEntry>()
    tree:CommentEntry[] = [];

    constructor() {
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
                const url = api + "/comment/" + comment.parent;
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

    async getRecent() {
        try {
            const url = api + "/comment/after/" + this.newest;
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
            }
        } catch (err) {
            console.log("failed to fetch recent comments " + JSON.stringify(err));
        }
    }
}