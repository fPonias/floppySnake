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

interface filters {
    file: string,
    list: string[],
    sz: number
}

const ipBlacklist: filters = {
    file: './ip-blacklist.txt',
    list: [],
    sz: 0
}

const idBlacklist: filters = {
    file: './greylist.txt',
    list: [],
    sz: 0
}

function reloadBlocklist(target: filters): boolean {
    try {
        const stats = fs.statSync(target.file);
        if (stats.size == target.sz) { return false; }

        const data = fs.readFileSync(target.file, { encoding: 'utf8' });
        target.list = data.split('\n');
        target.sz = stats.size;
        return true;
    } catch (err) {
        console.error(err);
    }

    return false;
}

export async function isBlacklisted(ip: string):Promise<boolean> {
    const result = reloadBlocklist(ipBlacklist)
    if (result) {
        console.log("reloaded ip blocklist with " + ipBlacklist.list.length + " entries");
    }
    const isIp4 = ip.indexOf("::ffff:") == 0;
    const ip4 = ip.substring(7);

    for (let i = 0; i < ipBlacklist.list.length; i++) {
        if (ipBlacklist.list[i].trim().length == 0) { continue; }
        if (ipBlacklist.list[i].startsWith('#')) { continue; }

        if (!isIp4 && ip.startsWith(ipBlacklist.list[i])) { 
            console.log("ip " + ip + " matches blacklist entry " + ipBlacklist.list[i]);
            return true; 
        }
        else if (isIp4 && ip4.startsWith(ipBlacklist.list[i])) { 
            console.log("ip " + ip4 + " matches blacklist entry " + ipBlacklist.list[i]);
            return true; 
        }
    }

    return false;
}