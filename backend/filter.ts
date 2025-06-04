import { getFilterList } from "./database";
import fs from 'fs';

const blackList = new Map<string, string[]>([
    ["kyle", ["Stan", "Kenny", "Cartman"]],
    ["lingworth", ["[redacted]"]],
    ["jericho", ["[redacted]"]],
    ["jerico", ["[redacted]"]],
    ["nigger", ["brilliant black man"]],
    ["ictoria", ["the great Queen"]],
    ["cody", ["[redacted]"]],
    ["unger", ["and her three legged dog Snake"]],
    ["nevada", ["Arizona", "Texas", "Florida"]],
    ["[deleted]", ["PN is a goddess", "I have 50TB of kiddie porn on my computer.", "I have a micropenis", "I'm a failed realtor", "I drive a cybertruck", "I'm a narcissitic stalker"]],
    ["greenbean", ["PN is a goddess", "I have 50TB of kiddie porn on my computer.", "I have a micropenis", "I'm a failed realtor", "I drive a cybertruck", "I'm a narcissitic stalker"]]
]);

async function getSortedFilterList(): Promise<Map<string, string[]>> {
    const list = await getFilterList();
    const ret = new Map<string, string[]>();

    for (let line of list) {
        const replacements = ret.get(line.pattern) ?? [];
        replacements.push(line.replace);
        ret.set(line.pattern, replacements);
    }

    return ret;
}

function matchFilter(input:string[], filter:string[]):number | null {
    //console.log('comparing ' + input + ' with ' + filter);
    let maxStart = input.length - filter.length;
    let i = 0;
    for (i = 0; i <= maxStart; i++) {
        let match = true;
        let k = 0;
        for (k = 0; k < filter.length; k++) {
            if (filter[k] != input[i + k]) {
                match = false;
                break;
            }
        }

        if (match) {
            return i;
        }
    }

    return null;
}

function stripSpaces(input:string):{stripped: string[], index: number[]} {
    const a = 'a'.charCodeAt(0);0
    const z = 'z'.charCodeAt(0);
    const A = 'A'.charCodeAt(0);
    const Z = 'Z'.charCodeAt(0);

    const stripped:string[] = [];
    const index:number[] = [];
    for (let i = 0; i < input.length; i++) {
        let intval = input.charCodeAt(i);
        if (intval >= a && intval <= z) {
            index.push(i);
            stripped.push(String.fromCharCode(intval));
        } else if (intval >= A && intval <= Z) {
            index.push(i);
            stripped.push(String.fromCharCode(intval - A + a));
        }
    }

    return {stripped, index};
}

export async function filterString(input:string):Promise<string> {
    const blackList = await getSortedFilterList();
    
    const {stripped, index} = stripSpaces(input);

    let i:number | null = null;
    let matched: string | null = null;
    let matchArr: string[] | null = null;
    for (let [key, value] of blackList) {
        const strippedKey = stripSpaces(key);
        i = matchFilter(stripped, strippedKey.stripped);
        if (i != null) {
            console.log("matched " + key);
            matched = key;
            matchArr = strippedKey.stripped;
            break;
        }
    }

    if (!matched || i == null || !matchArr) {
        return input.substring(0);
    }

    const start = index[i];
    let ret = input.substring(0, start);
    const picks = blackList.get(matched) ?? [""];
    const pick = Math.min(picks.length -1, Math.floor(Math.random() * picks.length));
    ret = ret + picks[pick] + " ";

    const nextIdx = i + matchArr.length;
    //console.log(nextIdx + JSON.stringify(index))
    if (nextIdx >= index.length) {
        return ret;
    }

    const next = index[nextIdx];
    const tail = await filterString(input.substring(next));
    ret = ret + tail;

    return ret;
}

const ipBlacklistFile = './ip-blacklist.txt';
let ipBlacklist: string[] = []
let ipFileSz = 0;
function reloadIpBlacklist() {
    try {
        const stats = fs.statSync(ipBlacklistFile);
        if (stats.size == ipFileSz) { return; }

        const data = fs.readFileSync(ipBlacklistFile, { encoding: 'utf8' });
        ipBlacklist = data.split('\n');
        ipFileSz = stats.size
        console.log("reloaded ip blacklist with " + ipBlacklist.length + " entries");
    } catch (err) {
        console.error(err);
    }
}

export function isBlacklisted(ip: string): boolean {
    reloadIpBlacklist();
    const isIp4 = ip.startsWith("::ffff:");
    const ip4 = ip.substring(7);

    for (let i = 0; i < ipBlacklist.length; i++) {
        if (ipBlacklist[i].trim().length == 0) { continue; }
        if (ipBlacklist[i].startsWith('#')) { continue; }
        
        if (!isIp4 && ip.startsWith(ipBlacklist[i])) { return true; }
        else if (isIp4 && ip4.startsWith(ipBlacklist[i])) { return true; }
    }

    return false;
}