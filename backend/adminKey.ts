import { randomUUID } from 'node:crypto';

let key = randomUUID();
let grants = new Set<string>();

export function resetKey() {
    grants.clear()
    key = "only Cleopatra died from a snake bite";
    showKey();
}

export function isAuthorized(token:any):boolean {
    if (grants.has(token)) { 
        console.log("grants has " + token)
        return true; 
    }
    if (token.params && token.params.token && grants.has(token.params.token)) { 
        console.log("grants has " + token.params.token)
        return true; 
    }
    if (token.cookies && token.cookies.token && grants.has(token.cookies.token)) { 
        console.log("grants has " + token.cookies.token)
        return true; 
    }

    return false;
}

export function showKey() {
    console.log("super secret key " + key);
}

export function authorize(requestKey:string):string | null {
    if (requestKey != key) { return null; }

    const ret = randomUUID();
    grants.add(ret);
    console.log("admin grants: " + JSON.stringify(grants));

    return ret;
}