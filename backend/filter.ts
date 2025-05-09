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


export function filterString(input:string):string {
    //console.log("filtering string " + input);
    const stripped:string[] = []
    const index:number[] = []
    
    const a = 'a'.charCodeAt(0);
    const z = 'z'.charCodeAt(0);
    const A = 'A'.charCodeAt(0);
    const Z = 'Z'.charCodeAt(0);
    const sqbrl = '['.charCodeAt(0);
    const sqbrr = ']'.charCodeAt(0);
    
    for (let i = 0; i < input.length; i++) {
        let intval = input.charCodeAt(i);
        if ((intval >= a && intval <= z) || intval == sqbrl || intval == sqbrr) {
            index.push(i);
            stripped.push(String.fromCharCode(intval));
        } else if (intval >= A && intval <= Z) {
            index.push(i);
            stripped.push(String.fromCharCode(intval - A + a));
        }
    }

    let matched: string | null = null;
    let i = 0;
    for (i = 0; i < stripped.length; i++) {
        for (let [key, value] of blackList) {
            let match = true;
            for (let k = 0; k < key.length; k++) {
                if (i + k >= stripped.length || key[k] != stripped[i + k]) {
                    match = false;
                    break;
                }
            }

            if (match) {
                matched = key;
            }
        }

        if (matched) {
            break;
        }
    }

    if (!matched) {
        return input.substring(0);
    }

    const start = index[i];
    let ret = input.substring(0, start);
    const picks = blackList.get(matched) ?? [""];
    const pick = Math.min(picks.length -1, Math.floor(Math.random() * picks.length));
    ret = ret + picks[pick] + " ";

    const nextIdx = i + matched.length;
    //console.log(nextIdx + JSON.stringify(index))
    if (nextIdx >= index.length) {
        return ret;
    }

    const next = index[nextIdx];
    const tail = filterString(input.substring(next));
    ret = ret + tail;

    return ret;
}
