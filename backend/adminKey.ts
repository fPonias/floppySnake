import { randomUUID } from 'node:crypto';

let key = randomUUID();
const grants:Set<string> = new Set();

export function resetKey() {
    grants.clear()
    key = randomUUID();
    showKey();
}

export function isAuthorized(token:string):boolean {
    return grants.has(token);
}

export function showKey() {
    console.log("super secret key " + key);
}

export function authorize(requestKey:string):string | null {
    if (requestKey != key) { return null; }

    const ret = randomUUID();
    grants.add(ret);

    return ret;
}