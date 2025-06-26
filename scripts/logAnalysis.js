import pkg from 'pg';
import env2 from '../env';
import fs from 'fs';

const env = (env2.default) ? env2.default : env2;
const { Pool } = pkg;
const pool = new Pool(env.dbArgs);

const folderPath = '../backups/logs';

function getMonthFromString(mon) {
    return new Date(Date.parse(mon + " 1, 2012")).getMonth();
}

async function analyzeLine(line) {
    if (line.length == 0) { return; }

    const parts = line.split(' ');
    if (parts.length < 10) { return; }

    const address = parts[0];
    const method = parts[5].substring(1);
    const request = parts[6];
    const code = parts[8];
    const size = (parts[9] == '-') ? 0 : parts[9];

    const dateStr = parts[3].substring(1) + "/" + parts[4].substring(0, parts[4].length - 1);
    const dateParts = dateStr.split(/[\:\/]/);
    const date = new Date();
    date.setFullYear(dateParts[2], getMonthFromString(dateParts[1]), dateParts[0]);
    date.setUTCHours(dateParts[3], dateParts[4], dateParts[5], 0);

    

    const text = `INSERT INTO ip_history (address, date, request, response, size, method)
            VALUES($1, $2, $3, $4, $5, $6)`
    const args = [address, date.getTime(), request, code, size, method]
    args["::ffff:209.51.14.206", 1746647912000, "\"GET", "HTTP/1.1\"", "200", "0000]"]
    console.log("args " + JSON.stringify(args));
    await pool.query(text, args)
}

async function analyzeFile(path) {
    console.log("analyzing " + path);

    const fp = fs.readFileSync(path, { encoding: 'utf8' });
    const lines = fp.split("\n");
    for (let line of lines) {
        console.log("parsing line " + line);
        await analyzeLine(line);
    }
}

async function delayed() {
    const direct = fs.readdirSync(folderPath);

    for (let file of direct) {
        console.log("opening file " + file);
        await analyzeFile(folderPath + "/" + file);
    }
}

delayed();