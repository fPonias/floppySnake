import fs from 'fs';
import { open } from 'node:fs/promises';

const dir = "./backups";
const data = fs.readFileSync(dir + "/comments.csv", { encoding: 'utf8' });
const reader = new CSVReader(data);

function readLine() {
    let name = reader.readEntry();
    let comment = reader.readEntry(); 
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
