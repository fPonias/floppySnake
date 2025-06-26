const EntryState = {
        START: 0,
        QUOTE: 1,
        QUOTED: 2,
        UNQUOTED: 3
    }

export default class CSVReader {
    data;
    index;
    
    constructor(data) {
        this.data = data;
        this.index = 0;
    }

    readEntry() {
        let state = EntryState.START;
        let ret = "";

        while (this.index < this.data.length) {
            const ch = this.data[this.index];
            switch (state) {
                case EntryState.START:
                    if (ch == '"') {
                        state = EntryState.QUOTE;
                    } else if (ch == ',' || ch == '\n') {
                        this.index += 1;
                        return "";
                    } else {
                        ret += ch;
                        state = EntryState.UNQUOTED;
                    }
                    break;
                case EntryState.UNQUOTED:
                    if (ch == "," || ch == '\n') {
                        this.index += 1;
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
                    } else {
                        ret += ch;
                    }
                    break;
                case EntryState.QUOTED:
                    if (ch == ',' || ch == '\n') {
                        this.index += 1;
                        return ret;
                    } else {
                        ret += ch;
                        state = EntryState.QUOTE;
                    }
                    break;
            }
            this.index += 1;
        }

        return ret;
    }
}