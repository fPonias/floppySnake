const webWhitelist = [
    "youtu.be/",
    "www.youtube.com/",
    "youtube.com/",
    "m.youtube.com/",
    "x.com/",
    "thehill.com/",
    "nypost.com/",
    "news.yahoo.com/"
];

export function findHyperlinks(message:string):string[] {
    const idx = message.indexOf("https://");
    if (idx == -1) { return [message]; }

    let url = "";
    let found = false;
    let i = 0;
    for (url of webWhitelist) {
        for (i = 0; i < url.length; i++) {
            if (url[i] != message[idx + i + 8]) {
                found = false;
                break;
            }
        }

        if (i == url.length) {
            found = true;
            break;
        }
    }

    if (found) {
        let end = idx + i
        for (end = idx + i; end < message.length; end++) {
            const ch = message[end];
            if (ch == ' ' || ch == '\n') {
                break;
            }
        }

        const link = message.substring(idx, end);

        const first = message.substring(0, idx);
        const sub = findHyperlinks(message.substring(end));
        sub.unshift(link);
        sub.unshift(first);
        return sub;
    } else {
        const first = message.substring(0, idx + 8);
        const sub = findHyperlinks(message.substring(idx + 8));
        const next = sub.shift();
        sub.unshift(first + next);
        return sub;
    }

}