const webWhitelist = [
    {host: "youtu.be/", name: "youTube"},
    { host: "www.youtube.com/", name: "youTube"},
    { host: "youtube.com/", name: "youTube" },
    { host: "m.youtube.com/", name: "youTube" },
    { host: "x.com/", name: "Twitter"},
    { host: "thehill.com/", name: "The Hill" },
    { host: "nypost.com/", name: "New York Post" },
    { host: "news.yahoo.com/", name: "Yahoo News" },
];

export function findFirstHyperlink(message: string): string | null {
    let ret = findHyperlink(message);
    if (ret.index == -1) { return null; }

    if (!ret.found) {
        return findFirstHyperlink(message.substring(ret.index + 8));
    }

    let end = ret.index + ret.length
    for (end = ret.index + ret.length; end < message.length; end++) {
        const ch = message[end];
        if (ch == ' ' || ch == '\n') {
            break;
        }
    }

    return message.substring(ret.index, end - ret.index);
}

function findHyperlink(message:string): {match: string, found: boolean, index: number, length: number} {
    const idx = message.indexOf("https://");
    if (idx == -1) { return {found: false, index: -1, length: 0, match: ""} }

    let urlDef:{host: string, name: string} | null = null;
    let found = false;
    let i = 0;
    for (urlDef of webWhitelist) {
        for (i = 0; i < urlDef.host.length; i++) {
            if (urlDef.host[i] != message[idx + i + 8]) {
                found = false;
                break;
            }
        }

        if (i == urlDef.host.length) {
            found = true;
            break;
        }
    }

    return {
        found: found,
        index: idx,
        length: i,
        match: urlDef?.name ?? ""
    };
}

export function findHyperlinks(message:string):{str: string, match: string | null}[] {
    const {found, index, length, match} = findHyperlink(message);
    if (index == -1) { return [{str: message, match: null}]};

    if (found) {
        let end = index + length
        for (end = index + length; end < message.length; end++) {
            const ch = message[end];
            if (ch == ' ' || ch == '\n') {
                break;
            }
        }

        const link = message.substring(index, end);

        const first = message.substring(0, index);
        const sub = findHyperlinks(message.substring(end));
        sub.unshift({str: link, match: match});
        sub.unshift({str: first, match: null});
        return sub;
    } else {
        const first = message.substring(0, index + 8);
        const sub = findHyperlinks(message.substring(index + 8));
        const next = sub.shift();
        sub.unshift({str: first + next, match: null});
        return sub;
    }

}