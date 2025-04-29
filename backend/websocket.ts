import env2 from '../env';
import { WebSocketServer } from "ws";
import { v4 } from "uuid";
import url from "url";

const env = (env2.default) ? env2.default : env2;

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
        const uuid = v4()
        this.connections.set(uuid, connection);
        console.log(`${uuid} connected`)

        connection.on("close", () => this.handleClose(uuid))
        connection.on("message", (event) => {
            console.log("socket message called with " + event);
            const data = JSON.parse(event);
            this.handleMessage(connection, data)
        })
    }

    isLoggedIn(token) {
        return this.connections.has(token);
    }

    connections = new Map<string, any>();

    private handleClose(uuid) {
        console.log(`${uuid} disconnected`)
        this.connections.delete(uuid);
    }

    broadcastNewPost(postid: number, updated: number) {
        const message = JSON.stringify({ action: "new", postid: postid, updated: updated });
        this.sendBroadcast(message);
    }

    broadcastUpdatePost(postid: number) {
        const message = JSON.stringify({ action: "update", postid: postid });
        this.sendBroadcast(message);
    }

    sendBroadcast(message:string) {
        const keys = this.connections.keys();
        for (let uuid of keys) {
            const connection = this.connections.get(uuid);
            connection.send(message)
        }
    }

    handleMessage(connection:any, json:any) {
        if (json.action == "apiTokenVerify") {
            let token = json.token;

            if (token && token.length > 0) {
                if (this.connections.has(token)) {
                    const oldConnection = this.connections.get(token);

                    if (oldConnection !== connection) {
                        console.log("old socket connection for " + token + " discarded");
                        oldConnection?.terminate();
                    }
                }
            } else {
                token = v4();
                console.log("creating new api token " + token)
            }

            this.connections.set(token, connection);
            const message = JSON.stringify({ action: "token", token: token });
            connection.send(message);
        }
    }
}