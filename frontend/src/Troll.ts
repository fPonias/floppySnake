import CryptoJS from 'crypto-js';

export class T {
    WORK_SIZE = 1024 * 32;
    WORK_LOOPS = 1024 * 10;

    items:String[] = [];

    workOnce() {
        const key = Math.random().toString();
        let chars: number[] = [];
        for (let j = 0; j < this.WORK_SIZE; j++) {
            chars[j] = Math.floor(Math.random() * 256);
        }

        const message = String.fromCharCode(...chars);
        const cypher = CryptoJS.AES.encrypt(message, key).toString();
        const bytes = CryptoJS.AES.decrypt(cypher, key);
        const str = bytes.toString(CryptoJS.enc.Utf8);

        this.items.push(str);
    }

    workDone = 0;
    workStart = 0

    doWork() {
        if (this.workDone == 0) {
            this.workStart = new Date().getTime();
        } /* else if (this.workDone >= this.WORK_LOOPS) { 
            const then = new Date().getTime();
            const diff = then - this.workStart;
            console.log("total work took " + diff + "ms"); 
            return; 
        } */

        if (this.workDone < 10) {
            this.doWork2()
            setTimeout(() => {
                this.doWork();
            }, Math.max(0, 10 - this.workDone));
        } else {
            while (true) {
                this.doWork2();
            }
        }
    }

    doWork2() {
        const now = new Date().getTime();
        this.workOnce();
        const then = new Date().getTime();
        const diff = then - now;
        console.log("work loop took " + diff + "ms");

        this.workDone += 1;
    }
}