import env2 from '../env';
import { WebSocketServer } from "ws";
import { v4 } from "uuid";
import url from "url";

const env = (env2.default) ? env2.default : env2;

export default class MyWebSocket{
    private static _instance:MyWebSocket | undefined = undefined;
    static get instance():MyWebSocket {
        if (!this._instance) {
            throw("MyWebSocket instance undefined");
        }

        return this._instance;
    }

    static init(server: any) {
        MyWebSocket._instance = new MyWebSocket(server);
    }

    wsServer:WebSocketServer
    
    private constructor(server: any) {
        console.log("new mywebsocket created for port " + env.wsport)
	this.wsServer = new WebSocketServer({ server });

        this.wsServer.on("connection", (connection, request) => { this.onConnected(connection, request); });

        server.listen(env.wsport, () => {
            console.log(`WebSocket server is running on port ${env.wsport}`)
        })
    }

    private onConnected(connection, request) {
        const uuid = v4()
        this.connections[uuid] = connection
        console.log(`${uuid} connected`)

        connection.on("close", () => this.handleClose(uuid))
    }

    connections = {}

    private handleClose(uuid) {
        console.log(`${uuid} disconnected`)
        delete this.connections[uuid]
    }

    broadcast(postid: number, updated: number) {
        Object.keys(this.connections).forEach((uuid) => {
            const connection = this.connections[uuid]
            const message = JSON.stringify({postid: postid, updated: updated});
            connection.send(message)
        })
    }
}
