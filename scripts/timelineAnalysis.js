import fs from 'fs';
import { open } from 'node:fs/promises';
import CSVReader from './csvReader';

const dir = "../backups/history";
const dir2 = "../backend";
const data = fs.readFileSync(dir + "/data-1750739605313.csv", { encoding: 'utf8' });
const reader = new CSVReader(data);

//629212, "::ffff:68.3.150.211", "1753223087000", "/gibberish/7233c461-697e-4f53-b127-42074d38109b", "200", 106, "GET", 
//"::ffff:68.3.150.211", "33.44843", "-112.07414", "United States", "Arizona", "Phoenix", "cox.com", "isp"
function readLine() {
    reader.readEntry();
    const address = reader.readEntry();
    const timestamp = reader.readEntry();
    const path = reader.readEntry();
    const status = reader.readEntry();
    const size = reader.readEntry();
    const method = reader.readEntry();
    reader.readEntry();
    const lat = reader.readEntry();
    const lon = reader.readEntry();
    const country = reader.readEntry();
    const state = reader.readEntry();
    const city = reader.readEntry();
    const service = reader.readEntry();
    const isIsp = reader.readEntry();

    return { 
        address: address,
        timestamp: Number.parseInt(timestamp),
        path: path,
        status: status,
        size: Number.parseInt(size),
        method: method,
        lat: Number.parseFloat(lat),
        lon: Number.parseFloat(lon),
        country: country,
        state: state,
        city: city,
        service: service,
        isIsp: isIsp == "isp" ? true : false,
    };
}

const ret = []
let first = true;
while (reader.index < data.length) {
    const line = readLine();
    
    if (first) {
        first = false;
    } else {
        ret.push(line);
    }
}

(async () => {
    const fd = await open(dir2 + '/historyParsed.json', 'w');

    fd.write(JSON.stringify(ret));
    fd.close();
})();
