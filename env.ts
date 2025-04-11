const port = 3003;
const sslDir = "/Users/codymunger/.ssh"; 
const sslEnabled = false;
const apiPrefix = (sslEnabled) ? "https" : "http";
const socketPrefix = (sslEnabled) ? "wss" : "ws";


const env = {
    port: port, 
    api: apiPrefix + '://localhost:' + port,
    socketUrl: socketPrefix + '://localhost:' + port,

    sslDir: sslDir,
    sslPrivate: sslDir + "/localhost.key",
    sslCert: sslDir + "/localhost.crt",
    sslEnabled: false,

    dbArgs: {
        user: 'floppysnake',
        host: 'localhost',
        database: 'floppysnake',
        password: 'aaAA11!!aa',
        port: 5432,
    },
}

export default env;
