import env from "../../env"

export interface UserData {
    commentCount: number,
    flaggedCount: number,
    lastPost: number,
    visitorid: number,
    token: string,
    ipAddress: string,
    names: string[],
    isActive: boolean
    alias: string
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

    async loadActiveUsers() {
        if (!this.adminToken) { return }
        if (!this.userData || this.userData.length == 0) { return; }

        try {
            const url = env.api + "/activeUsers/" + this.adminToken;
            const resp = await fetch(url, {
                credentials: "include"
            });

            const activeUsers = await resp.json();
            const set = new Set<string>();
            for (let user of activeUsers) {
                set.add(user.token);
            }

            for (let userD of this.userData) {
                if (set.has(userD.token)) {
                    userD.isActive = true;
                } else {
                    userD.isActive = false;
                }
            }

            this.userData = this.userData.sort((a, b) => {
                if (a.isActive != b.isActive) {
                    if (a.isActive) { return -1 } else { return 1 }
                }

                return (a.lastPost - b.lastPost);
            })
        } catch (err) {
            console.log("failed to flag post entry " + JSON.stringify(err));
        }
    }

    async runUpdate() {
        await this.loadUserData();
        await this.loadActiveUsers();
        
        for(let listener of this.userDataListener) {
            listener(this.userData);
        }
    }
}