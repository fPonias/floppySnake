import env2 from '../env';
import { WebSocketServer } from "ws";
import { v4 } from "uuid";
import url from "url";

const env = (env2.default) ? env2.default : env2;

export default class MyWebSocket{
    private static _instance:MyWebSocket | undefined = undefined;
    static get instance():MyWebSocket {
        if (!this._instance) {
            throw("MyWebSocket not initialized with init()")
        }

        return MyWebSocket._instance!!;
    }

    static init(server:any) { 
        MyWebSocket.server = server;
        MyWebSocket._instance = new MyWebSocket();
    }

    static server: any
    server:WebSocketServer
    wss:WebSocketServer
    
    private constructor() {
        this.wss = new WebSocketServer({server: MyWebSocket.server});
        console.log("new mywebsocket created for port " + env.wsport)

        this.wss.on('connection', this.onConnected);

        MyWebSocket.server.listen(env.port);
    }

    private onConnected(ws) {
        ws.on('error', console.error);
    }

    broadcast(postid: number, updated: number) {
        const message = JSON.stringify({ postid: postid, updated: updated });
        for (let client of this.wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message, { binary: false });
            }
        };
    }
}
