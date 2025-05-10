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

    async runUpdate() {
        await this.loadUserData();
        
        for(let listener of this.userDataListener) {
            listener(this.userData);
        }
    }
}