import fs from 'fs';
import { open } from 'node:fs/promises';

const dir = "./backups";
const data = fs.readFileSync(dir + "/comments.csv", { encoding: 'utf8' });
let index = 0;

const EntryState = {
    START: 0,
    QUOTE: 1,
    QUOTED: 2,
    UNQUOTED: 3
}

function readEntry() {
    let state = EntryState.START;
    let ret = "";

    while (index < data.length) {
        const ch = data[index];
        switch (state) {
            case EntryState.START:
                if (ch == '"') {
                    state = EntryState.QUOTE;
                } else if (ch == ',' || ch == '\n') {
                    index += 1;
                    return "";
                } else {
                    ret += ch;
                    state = EntryState.UNQUOTED;
                }
                break;
            case EntryState.UNQUOTED:
                if (ch == "," || ch == '\n') {
                    index += 1;
                    return ret;
                } else {
                    ret += ch;
                }
                break;
            case EntryState.QUOTE:
                if (ch == "'") {
                    state = EntryState.QUOTED;
                } else if (ch == '"') {
                    state = EntryState.UNQUOTED;
                }else {
                    ret += ch;
                }
                break;
            case EntryState.QUOTED:
                if (ch == ',' || ch == '\n') {
                    index += 1;
                    return ret;
                } else {
                    ret += ch;
                    state = EntryState.QUOTE;
                }
                break;
        }
        index += 1;
    }

    return ret;
}

function readLine() {
    let name = readEntry();
    let comment = readEntry(); 
    return {name: name, comment: comment};
}

const names = new Map();
const wordData = new Map();
const firstWord = {
    word: "",
    next: new Map(),
    count: 1,
    endsFrequency: 0,
    nextCount: 0,
}
wordData.set("", firstWord)

let j = 0;
while (index < data.length) {
    const line = readLine();
    const nameData = names.get(line.name);
    if (nameData) {
        nameData.frequency += 1;
    } else {
        names.set(line.name, { name: line.name, frequency: 1 });
    }

    const words = line.comment.split(/(\s+)/);
    let previous = firstWord;
    for (let i = 0; i < words.length; i++) {
        const w = words[i].trim();
        if (w.length == 0) { continue; }
        
        let commentData = wordData.get(w);
        if (!commentData) {
            commentData = {
                word: w,
                next: new Map(),
                count: 1,
                endsFrequency: 0,
                nextCount: 0
            };
            wordData.set(w, commentData);
        } else {
            commentData.count += 1;
        }

        if (commentData) {
            const nextData = previous.next.get(words[i]);
            if (!nextData) {
                previous.next.set(words[i], {word: words[i], frequency: 1});
            } else {
                nextData.frequency += 1;
            }

            previous.nextCount += 1;

            previous = commentData;
        }
    }

    if (words.length) {
        let commentData = wordData.get(words[words.length - 1]);
        commentData.endsFrequency += 1;
    }

    j += 1;
}

function mapToStringable(map) {
    const values = [];
    for (let key of map.keys()) {
        const value = map.get(key);
        values.push(value);
    }

    return values;
}

function wordDataToStringable(map) {
    const values = [];
    for (let key of map.keys()) {
        const value = map.get(key);
        value.next = mapToStringable(value.next);
        values.push(value);
    }

    return values;
}

(async () => {
    const fd = await open(dir + '/comments-parsed.json', 'w');
    
    let json = {
        words: wordDataToStringable(wordData),
        first: firstWord,
        names: mapToStringable(names)
    };
    fd.write(JSON.stringify(json));
    fd.close();
})();
