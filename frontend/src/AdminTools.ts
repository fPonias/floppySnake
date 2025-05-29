import env from "../../env"

export interface IPAddress {
    address: string, 
    blocked: boolean,
}

export interface UserData {
    commentCount: number,
    flaggedCount: number,
    lastPost: number,
    visitorid: number,
    token: string,
    ipAddresses: IPAddress[],
    names: string[],
    isActive: boolean
    alias: string,
    blocked: boolean
}

export interface Filter {
    id?: number,
    pattern: string,
    replace: string
}

export interface User {
    id: number,
    token: string
}

export class AdminTools {
    adminToken: string | null = null;

    userData:UserData[] = []

    userDataListener:((userData:UserData[]) => void)[] = [];
    addUserDataListener(listener: (userData: UserData[]) => void) {
        this.userDataListener.push(listener);
    }

    async loadUserData() {
        if (!this.adminToken) {
            this.userData = [] 
            return;
        }

        try {
            const url = env.api + "/userData/" + this.adminToken;
            const resp = await fetch(url, {
                credentials: "include"
            });

            this.userData = await resp.json();

            return;
        } catch (err) {
            console.log("failed to flag post entry " + JSON.stringify(err));
        }

        this.userData = [];
    }

    async runUpdate() {
        await this.loadUserData();
        
        for(let listener of this.userDataListener) {
            listener(this.userData);
        }
    }

    async runUpdateFilters() {
        await this.loadFilters();

        for (let listener of this.filterListener) {
            listener(this.filters);
        }
    }

    filters: Filter[] = [];

    filterListener: ((filters: Filter[]) => void)[] = [];
    addFilterListener(listener: (filter: Filter[]) => void) {
        this.filterListener.push(listener);
    }

    async loadFilters() {
        if (!this.adminToken) {
            this.filters = [];
            return;
        }

        try {
            const url = env.api + "/filter/" + this.adminToken;
            const resp = await fetch(url, {
                credentials: "include"
            });

            this.filters = await resp.json();

            

            return;
        } catch (err) {
            console.log("failed to fetch filters " + JSON.stringify(err));
        }

        this.filters = [];
    }

    async updateFilter(filter: Filter) {
        await this.addFilter(filter);
    }

    async addFilter(filter: Filter) {
        if (!this.adminToken) {
            return;
        }

        try {
            let url = env.api + "/filter/"
            url += this.adminToken;

            const body = JSON.stringify(filter);
            await fetch(url, {
                method: 'POST',
                credentials: "include",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body
            });

            return;
        } catch (err) {
            console.log("failed to add filter " + JSON.stringify(err));
        }
    }

    async delteFilter(filterid: number) {
        if (!this.adminToken) {
            return;
        }

        try {
            const url = env.api + "/filter/" + filterid + "/" + this.adminToken;
            await fetch(url, {
                method: 'DELETE',
                credentials: "include",
            });

            return;
        } catch (err) {
            console.log("failed to add filter " + JSON.stringify(err));
        }
    }
    
    async blockUser(userId: number, blocked: boolean) {
        if (!this.adminToken) {
            return;
        }

        try {
            const body = JSON.stringify({id: userId, blocked: blocked});
            const url = env.api + "/blockUser/" + this.adminToken;
            await fetch(url, {
                method: "POST", 
                credentials: "include",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body
            });

            return;
        } catch (err) {
            console.log("failed to block user " + JSON.stringify(err));
        }
    }

    async blockIP(address: string, blocked: boolean) {
        if (!this.adminToken) {
            return;
        }

        try {
            const body = JSON.stringify({ address: address, blocked: blocked });
            const url = env.api + "/blockIP/" + this.adminToken;
            await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body
            });

            return;
        } catch (err) {
            console.log("failed to block user " + JSON.stringify(err));
        }
    }
}