import fs from 'fs';
import nameData from '../backups/ngram'
import CommentData from '../backups/ngram'
import NextWordData from '../backups/ngram'

interface GibberishEntry {
    name: stirng,
    message: string
}

export class Gibberish {
    dir = "../backups";
    names = new Map<string, nameData>();
    namesCount = 0;
    words = new Map<string, CommentData>();
    firstWord:CommentData = {
        word: "",
        next: new Map(),
        count: 1,
        endsFrequency: 0
    }

    generated:Map<number, GibberishEntry> = new Map(); 

    load() {
        const data = fs.readFileSync(this.dir + "/comments-parsed.json", { encoding: 'utf8' });
        const json = JSON.parse(data);

        for (let name of json.names) {
            this.names.set(name.name, name);
            this.namesCount += name.frequency;
        }
        console.log("loaded " + json.names.length + " names");

        for (let word of json.words) {
            const next = word.next;
            const nextMap = new Map<string, NextWordData>()
            for (let n of next) {
                nextMap.set(n.word, n);
            }

            word.next = nextMap;
            this.words.set(word.word, word);
        }
        console.log("loaded " + json.words.length + " words");

        const next = json.first.next;
        const nextMap = new Map<string, NextWordData>()
        for (let n of next) {
            nextMap.set(n.word, n);
        }

        json.first.next = nextMap;
        this.firstWord = json.first;
        console.log("loaded " + next.length + " first words");
    }

    getComment(id: number): GibberishEntry {
        if (!this.generated.has(id)) {
            this.generated.set(id, this.createComment());
        }

        return this.generated.get(id);
    }

    createComment():GibberishEntry {
        let currentWord = this.firstWord;
        let count = 0;
        let message = "";

        let rand = Math.floor(Math.random() * 100)
        let length = 3;
        if (rand < 5) {
            length = 3;
        } else if (rand < 10) {
            length = 5;
        } else if (rand < 95) {
            length = 15;
        } else {
            length = 250;
        }

        console.log("generating message max length " + length);
        while (currentWord && count < length) {
            rand = Math.floor(Math.random() * currentWord.nextCount);
            let keys = currentWord.next.keys().toArray();
            let next = currentWord.next.get(keys[0]);
            for (let k = 1; k < keys.length; k++) {
                let key = keys[k];
                if (!next) { break; }
                rand = rand - next.frequency;
                if (rand <= 0) {break}
                next = currentWord.next.get(key);
            }

            if (!next) { break; }

            if (currentWord != this.firstWord) {
                message += " ";
            }

            message += next.word;

            rand = Math.floor(Math.random() * next.count);
            if (rand <= next.endsFrequency) {break;}

            currentWord = this.words.get(next.word);
            count += 1;
        }

        let name = "";
        rand = Math.floor(Math.random() * this.namesCount)
        for (let key of this.names.keys()) {
            let n = this.names.get(key);
            rand -= n.frequency;

            if (rand <= 0) {
                name = n.name;
                break;
            }
        }

        const ret = {
            name: (name.trim().toLowerCase() != "penguin") ? name : "",
            message: message
        };
        
        return ret;
    }
}


export const GibberishInstance = new Gibberish();