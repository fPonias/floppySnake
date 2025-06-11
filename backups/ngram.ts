import fs from 'fs';
import { open } from 'node:fs/promises';

const data = fs.readFileSync("./comments.csv", { encoding: 'utf8' });
let index = 0;

enum EntryState {
    START,
    QUOTE,
    QUOTED,
    UNQUOTED
}

function readEntry():string {
    let state = EntryState.START;
    let ret = "";

    while (index < data.length) {
        const ch = data[index];
        switch (state) {
            case EntryState.START:
                if (ch == '"') {
                    state = EntryState.QUOTE;
                } else {
                    state = EntryState.UNQUOTED;
                }
                break;
            case EntryState.UNQUOTED:
                if (ch == ",") {
                    return ret;
                } else {
                    ret += ch;
                }
                break;
            case EntryState.QUOTE:
                if (ch == '"') {
                    state = EntryState.QUOTED;
                } else {
                    ret += ch;
                }
                break;
            case EntryState.QUOTED:
                if (ch == ',') {
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

function readLine():{name: string, comment: string} {
    let name = readEntry();
    let comment = readEntry(); 
    return {name: name, comment: comment};
}

export interface NameData {
    name:string,
    frequency: number
};

export interface NextWordData {
    word: string,
    frequency: number
}

export interface CommentData {
    word: string,
    next: Map<string, NextWordData>
    count: number,
    nextCount: number,
    endsFrequency: number
};

const names = new Map<string, NameData>();
const wordData = new Map<string, CommentData>();
const firstWord:CommentData = {
    word: "",
    next: new Map(),
    count: 1,
    endsFrequency: 0
}
wordData.set("", firstWord)

let j = 0;
while (index < data.length && j < 3) {
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
        let commentData = wordData.get(w);
        if (!commentData) {
            commentData = {
                word: w,
                next: new Map(),
                count: 1,
                endsFrequency: 0
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

(async () => {
    const fd = await open('./comments-parsed.json', 'w');
    fd.write(JSON.stringify(wordData));
    fd.write(JSON.stringify(firstWord));
    fd.write(JSON.stringify(names));
    fd.close();
})();
