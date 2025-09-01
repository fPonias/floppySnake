import { randomUUID } from 'node:crypto';
import env2 from '../env';

const env = (env2.default) ? env2.default : env2;

let key = randomUUID();
let grants = new Set<string>();

export function resetKey() {
    grants.clear()
    key = env.adminPassword;
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
    if (requestKey != key) { 
        console.log("admin request failed with " + requestKey);
        return null; 
    }

    const ret = randomUUID();
    grants.add(ret);
    console.log("admin grants: " + JSON.stringify(grants));

    return ret;
}