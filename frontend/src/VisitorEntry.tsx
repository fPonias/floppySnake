import env from "../../env";

export interface IVisitorEntry {
    id: number,
    alias: string | null
}

export class VisitorEntry implements IVisitorEntry {
    id: number
    alias: string
    updated: number

    constructor(row:any) {
        this.id = row.visitorid;
        this.alias = row.alias;
        this.updated = row.updated;
    }
}

export default class VisitorEntries {
    entries: Map<number, VisitorEntry> = new Map();
    lastUpdated: number = 0

    constructor() {
        const dt = new Date();
        dt.setHours(0, 0, 0, 0);
        let tm = dt.getTime();
        tm = tm - (1000 * 60 * 60 * 24);
        this.lastUpdated = tm;
    }

    visitorDataListener: ((data:Map<number, VisitorEntry>) => void)[] = [];
    addVisitorDataListener(listener: (data: Map<number, VisitorEntry>) => void) {
        this.visitorDataListener.push(listener);
    }

    async fetchNewest() {
        const url = env.api + "/alias/" + this.lastUpdated;
        const res = await fetch(url);
        const json = await res.json();

        for (let i = 0; i < json.length; i++) {
            const entry = json[i];
            this.entries.set(entry.visitorid, entry);
        }

        for(let i = 0; i < this.visitorDataListener.length; i++) {
            const listener = this.visitorDataListener[i];
            listener(this.entries);
        } 
    }

    async updateAlias(data: IVisitorEntry, adminToken: string) {
        const url = env.api + "/alias/" + data.id + "/" + adminToken;
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({alias: data.alias})
        });
    }
}