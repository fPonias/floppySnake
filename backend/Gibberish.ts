import fs from 'fs';
import { NameData, CommentData, NextWordData } from '../backups/ngram'

export interface GibberishEntry {
    name: string,
    message: string
}

export class Gibberish {
    dir = "../backups";
    names = new Map<string, NameData>();
    namesCount = 0;
    words = new Map<string, CommentData>();
    firstWord:CommentData = {
        word: "",
        next: new Map(),
        count: 1,
        endsFrequency: 0,
        nextCount: 0
    }

    generated:Map<number, GibberishEntry> = new Map(); 
    arr:GibberishEntry[] = [];

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

    getComment(id: number): GibberishEntry | undefined {
        if (!this.generated.has(id)) {
            this.generated.set(id, this.createComment());
        }

        return this.generated.get(id);
    }

    getCommentByIndex(index: number): GibberishEntry | undefined {
        const count = this.arr.length;
        
        if (count == 0) {
            return this.createComment()
        }

        const idx = index % count;
        return this.arr[idx];
    }

    createComment(forceLength: number | undefined = undefined):GibberishEntry {
        let currentWord: CommentData | undefined = this.firstWord;
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

        if (forceLength) {
            length = forceLength;
        }

        console.log("generating message max length " + length);
        while (currentWord && count < length) {
            rand = Math.floor(Math.random() * currentWord.nextCount);
            let next: NextWordData | undefined = undefined;
            for (let key of currentWord.next.keys()) {
                next = currentWord.next.get(key);
                if (next == null) { break; }
                rand = rand - next.frequency;
                if (rand <= 0) {break}
            }

            if (!next) { break; }

            if (currentWord != this.firstWord) {
                message += " ";
            }

            message += next.word;

            const max = currentWord.nextCount + currentWord.endsFrequency;
            rand = Math.floor(Math.random() * max);

            if (rand <= currentWord.endsFrequency && forceLength == undefined) { break; }

            currentWord = this.words.get(next.word);
            count += 1;
        }

        let name = "";
        rand = Math.floor(Math.random() * this.namesCount)
        for (let key of this.names.keys()) {
            let n = this.names.get(key);
            if (!n) { continue; }
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
        
        console.log("generated name: " + ret.name + " message: " + ret.message);
        return ret;
    }
}


export const GibberishInstance = new Gibberish();
