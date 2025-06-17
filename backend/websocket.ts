import env2 from '../env';
import { WebSocketServer } from "ws";
import { v4 } from "uuid";
import url from "url";
import { checkToken, UserData, BlackListType, isUserBlacklisted } from './database';
import { authorize, getGrants, isAuthorized } from './adminKey';
import { isBlacklisted } from './filter';

const env = (env2.default) ? env2.default : env2;

interface connectionData {
    connection: any,
    id: number,
    token: string | undefined,
    ip: string,
    isAdmin: boolean,
    isBlacklisted: BlackListType,
}

export default class MyWebSocket {
    private static _instance: MyWebSocket | undefined = undefined;
    static get instance(): MyWebSocket {
        if (!this._instance) {
            throw ("MyWebSocket instance undefined");
        }

        return this._instance;
    }

    static init(wss: WebSocketServer) {
        MyWebSocket._instance = new MyWebSocket(wss);
    }

    wss: WebSocketServer

    private constructor(wss: WebSocketServer) {
        this.wss = wss;
        this.wss.on("connection", (connection, request) => { this.onConnected(connection, request); });
    }

    private onConnected(connection, request) {
        const ip = request.socket.remoteAddress;

        const connData:connectionData = {
            connection: connection,
            id: this.connectionsNextId,
            ip: request.socket.remoteAddress,
            token: undefined,
            isAdmin: false,
            isBlacklisted: BlackListType.BLOCKED,
        };
        console.log("connection " + connData.id + " opened");
        this.connections.set(connData.id, connData);
        this.connectionsNextId += 1;

        connection.on("close", () => this.handleClose(connData))
        connection.on("message", (event) => {
            console.log("socket message called with " + event);
            const data = JSON.parse(event);
            this.handleMessage(connData, connection, data)
        })
    }

    isLoggedIn(token) {
        return this.tokenIndex.has(token);
    }

    connectionsNextId = 1;
    connections = new Map<number, connectionData>();
    tokenIndex = new Map<string, connectionData>();

    private handleClose(connData:connectionData) {
        console.log(`${connData.id} disconnected`);
        this.connections.delete(connData.id);
        if (connData.token) {
            this.tokenIndex.delete(connData.token);
            this.sendAdminBroadcast(JSON.stringify({action: "logout", data: connData.token}));
        }
    }

    broadcastBlocked(updated: number) {
        const message = JSON.stringify({action: "block", updated: updated});
        this.sendBroadcast(message);
    }

    broadcastNewPost(postid: number, updated: number) {
        const message = JSON.stringify({ action: "new", postid: postid, updated: updated });
        this.sendBroadcast(message);
    }

    broadcastUpdatePost(postid: number) {
        const message = JSON.stringify({ action: "update", postid: postid });
        this.sendBroadcast(message);
    }

    broadcastUpdateAlias(after: number, visitorid: number) {
        const message = JSON.stringify({ action: "alias", visitorid: visitorid, after: after});
        this.sendBroadcast(message);
    }

    broadcastAllowPosts(allowPosts:boolean) {
        const message = JSON.stringify({ action: "allowPosts", allowPosts: allowPosts});
        this.sendBroadcast(message);
    }

    broadcastFiltersUpdated() {
        const message = JSON.stringify({action: "filtersUpdated"});
        this.sendAdminBroadcast(message);
    }

    broadcastGibberish() {
        const message = JSON.stringify({action: "gibberish"});
        this.sendBroadcast(message);
    }

    sendMessage(token: string, message:string) {
        const conn = this.tokenIndex.get(token);
        if (!conn) { return; }

        conn.connection.send(message);
    }

    sendBroadcast(message:string) {
        const keys = this.connections.keys();
        for (let id of keys) {
            const connData = this.connections.get(id);
            connData?.connection.send(message)
        }
    }

    sendAdminBroadcast(message:string) {
        const keys = this.connections.keys();
        for (let id of keys) {
            const connData = this.connections.get(id);
            if (connData?.isAdmin) {
                console.log("sending admin broadcast to " + JSON.stringify(connData.token))
                connData.connection.send(message);
            }
        }
    }

    handleMessage(connData:connectionData, connection:any, json:any) {
        if (json.action == "apiTokenVerify") {
            let token = json.token;

            if (token && token.length > 0) {
                if (this.connections.has(connData.id)) {
                    const oldConnection = this.connections.get(connData.id);

                    if (oldConnection?.connection !== connection) {
                        console.log("old socket connection for " + token + " discarded");
                        oldConnection?.connection.terminate();
                    }
                }
            } else {
                token = v4();
                console.log("creating new api token " + token)
            }

            checkToken(token, connData.ip).then(async (visitorid) => {
                connData.token = token;
                this.tokenIndex.set(token, connData);
                console.log("visitor " + visitorid + " logged in");
                const userStatus = await isUserBlacklisted(token);

                const message = JSON.stringify({ action: "token", token: token, status: userStatus });
                connection.send(message);

                this.sendAdminBroadcast(JSON.stringify({ action: "login", token: token }));
            });
        } else if (json.action == "adminTokenVerify") {
            let adminToken = json.token;
            const isAdmin = isAuthorized(adminToken)
            connData.isAdmin = isAdmin;

            const message = JSON.stringify({ action: "isAdmin", result: isAdmin});
            connection.send(message);
        } else if (json.action == "adminTokenRequest") {
            let password = json.password;
            const adminToken = authorize(password);

            connData.isAdmin = (adminToken) ? true : false;

            const message = JSON.stringify({ action: "adminToken", result: adminToken });
            connection.send(message);
        }
    }

    markActiveUsers(userData:UserData[]) {
        for (let data of userData) {
            if (this.tokenIndex.has(data.token)) {
                data.isActive = true;
            } else {
                data.isActive = false;
            }
        }
    }

    getActiveTokens():string[] {
        const ret:string[] = [];
        for (let item of this.connections.values()) {
            if (item.token) {
                ret.push(item.token);
            }
        }

        return ret;
    }
}