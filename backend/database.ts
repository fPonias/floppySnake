import pkg from 'pg';
import env2 from '../env';
import { response } from 'express';
import MyWebSocket from './websocket';

const env = (env2.default) ? env2.default : env2;

const { Pool } = pkg;

const pool = new Pool(env.dbArgs);

const commentQuery = `
    SELECT comment.*, b.blocked FROM comment
    LEFT OUTER JOIN (
    	SELECT ip.blocked OR visitor.blocked AS blocked, visitor.id FROM ip_visitor iv
    		LEFT OUTER JOIN ip ON ip.id = iv.ipid
    		LEFT OUTER JOIN visitor ON visitor.id = iv.visitorid
    ) b ON b.id = comment.visitorid
`

const commentLimit = 300

export const getTopComments = async (postid: number): Promise<any[]> => {
    try {
        const res = await pool.query(`${commentQuery} WHERE postid = $1 ORDER BY updated DESC LIMIT ${commentLimit}`, [postid]);
        return res.rows;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

export const getRecentComments = async (postid: number, after: number):Promise<any[]> => {
    try {
        const res = await pool.query(`${commentQuery} WHERE updated >= $1 AND postid = $2 ORDER BY updated DESC LIMIT ${commentLimit}`, [after, postid]);
        return res.rows;
    } catch(err) {
        console.error(err);
        throw new Error("Internal server error");
    }
};


export const getOlderComments = async (postid: number, before: number): Promise<any[]> => {
    try {
        const res = await pool.query(`${commentQuery} WHERE updated < $1 AND postid = $2 ORDER BY updated DESC LIMIT ${commentLimit}`, [before, postid]);
        return res.rows;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }

}

export const getComment = async (id:number): Promise<any> => {
    try {
        const res = await pool.query(`${commentQuery} WHERE comment.id = $1`, [id]);
        return res.rows[0];
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}
export const flagComment = async(id:number):Promise<any> => {
    try {
        const now = new Date().getTime();
        const res = await pool.query("UPDATE comment SET flagged=true, updated=$2 WHERE id = $1", [id, now]);

        updateParent(id, now);
        return true;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

export const updateParent = async (id: number, date: number, failsafe: number = 0) => {
    if (failsafe > 20) {
        console.log("maximum parent depth of 20 reached");
        throw new Error("maximum parent depth of 20 reached");
    }

    try {
        console.log("updating parent " + id);
        let text = "SELECT parent FROM comment WHERE id = $1";
        let result = await pool.query(text, [id]);

        if (result.rows.length > 0) {
            const nextParent = result.rows[0].parent;

            text = "UPDATE comment SET updated = $1 WHERE id = $2";
            result = await pool.query(text, [date, id]);

            if (result && nextParent != null) { 
                await updateParent(nextParent, date, failsafe + 1);
            }
        }
    } catch (error_1) {
        console.error(error_1);
        throw new Error("Internal server error");
    }
}

const youtube = [
    "youtu.be/",
    "www.youtube.com/",
    "youtube.com/",
    "m.youtube.com/",
]

interface previewData {
    title: string, 
    imageUrl: string, 
    start: number, 
    url: string 
}

async function assembleYouTubeData(str: string, id: string):Promise<previewData | null> {
    const url = "https://www.googleapis.com/youtube/v3/videos" +
        "?key=" + env.googleKey +
        "&id=" + id +
        "&part=snippet";

    try {
        const resp = await fetch(url);
        const videoData = await resp.json();
        const item = videoData.items[0].snippet;
        const title = item.title;
        const thumb = item.thumbnails.default;

        console.log("retrieved data for youtube video " + title);
        return {
            imageUrl: thumb.url,
            start: 0,
            url: str,
            title: title
        }
    } catch (e) {
        console.log("failed to fetch " + url + " with " + e);
        return null;
    }
}

async function parseYouTube(str:string):Promise<previewData | null> {
    if (str.indexOf("watch") > -1) {
        //https://www.youtube.com/watch?v=CMWLX0KXwF4
        const parts = str.split("=");
        const id = parts[1];
        return await assembleYouTubeData(str, id);
    } else {
        //https://www.youtube.com/shorts/naH-EbniNGc
        //https://youtu.be/AkFqg5wAuFk?si=8QI-3SmoRpoiTvUw
        const parts = str.split("?");
        const pathParts = parts[0].split("/");
        const id = pathParts[pathParts.length - 1];
        return await assembleYouTubeData(str, id);
    }
}

async function getThumbDets(msg: string): Promise<previewData | null> {
    var stringArr = msg.split(/(\s+)/);
    
    for (let i = 0; i < stringArr.length; i++) {
        const str = stringArr[i];
        if (!str.startsWith("http")) {
            continue;
        }

        for (let j = 0; j < youtube.length; j++) {
            if (str.indexOf(youtube[j]) == 8){
                console.log("matched host " + youtube[j])
                const str2 = str.substring(8 + youtube[j].length);
                const ret:previewData | null = await parseYouTube(str2);

                if (ret == null) { return null; }
                ret.start = msg.indexOf(ret.url);
                return ret;
            }
        }
    }

    return null;
}

export const createComment = async (
    token: string, 
    comment:string, 
    name: string | null,
    postid: number, 
    parent:number | null,
    original: string | null,
) => {
    try {
        if(!MyWebSocket.instance.isLoggedIn(token)) {
            console.log("invalid user attempted to post comment");
            throw new Error("invalid user attempt to post comment");
        }

        const now = new Date().getTime();

        let text = `SELECT updated, created FROM visitor WHERE visitor.token=$1`;
        let result = await pool.query(text, [token]);
        if (result.rows.length == 0) {
            throw new Error("invalid user posted");
        }
        
        let diff = now - result.rows[0].updated;
        if (diff < 1000) {
            throw new Error("comment posted too quickly");
        }

        diff = now - result.rows[0].created;
        console.log("user create diff " + diff);
        if (diff < 12000) {
            throw new Error("new user posted too quickly");
        }

        const thumbDets = await getThumbDets(comment);

        text = `UPDATE visitor SET updated = $1 WHERE token = $2`;
        await pool.query(text, [new Date().getTime(), token]);

        const short = comment.substring(0, 400);
        text = `INSERT INTO comment (parent, name, posted, updated, comment, postid, original, flagged, visitorid)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, (
                SELECT id AS visitorid FROM visitor WHERE token = $9
            )) RETURNING id
        `;
        const values = [parent, name, now, now, short, postid, original ?? "", false, token];
        result = await pool.query(text, values);
        if (result && result.rows) {
            const ret = result.rows[0];

            if (thumbDets != null) {
                text = `UPDATE comment SET thumbnail = $1, thumbTitle = $2 WHERE id = $3`
                await pool.query(text, [thumbDets.imageUrl, thumbDets.title, ret.id]);
            }

            if (parent != null) {
                await updateParent(parent, now);
            }

            return ret;
        } else {
            throw new Error("Comment creation failed");
        }
    } catch (error_1) {
        console.error(error_1);
        throw new Error("Internal server error");
    }
}

export const deleteComment = async (id: number):Promise<number | null> => {
    try {
        const now = new Date().getTime();
        const original = await pool.query("SELECT comment FROM comment WHERE id = $1", [id]);
        await pool.query("UPDATE comment SET name = $1, comment = $1, updated = $2, original = $4 WHERE id = $3", 
            ["[deleted]", now, id, original.rows[0].comment]
        );
        return now;
    } catch (error) {
        console.error(error);
        throw new Error("Internal server error");
    }

    return null;
}

export interface CommentCountInfo {
    min: number,
    count: Number;
};

export async function getCommentCount(postid: number):Promise<CommentCountInfo | null> {
    try {
        const result = await pool.query("SELECT COUNT(id), MIN(updated) FROM comment WHERE postid = $1", [postid]);
        console.log("count response " + JSON.stringify(result.rows));
        return {min: Number.parseInt(result.rows[0].min), count: Number.parseInt(result.rows[0].count)};
    } catch(error) {
        console.error(error);
        throw new Error("Internal server error");
    }
}

export async function getPost(url: string):Promise<number | null> {
    try {
        const result = await pool.query("SELECT id FROM post WHERE url = $1", [url]);
        console.log("post response " + JSON.stringify(result.rows));

        if (result.rows.length > 0) {
            return result.rows[0].id;
        } else { 
            return null;
        }
    } catch(error) {
        console.error(error);
        throw new Error("Internal server error");
    }

    return null;
}

export async function createPost(url: string): Promise<number | null> {
    try {
        const text = "INSERT INTO post (url) VALUES ($1) RETURNING id";
        const values = [url];
        const result = await pool.query(text, values);
        if (result && result.rows) {
            const ret = result.rows[0].id;
            return ret;
        }
    } catch (error) {
        console.error(error);
        throw new Error("Internal server error");
    }

    return null;
}

async function ipLookup(ipStr:string) {
    //https://api.ipregistry.co/209.51.14.206?key={apiKey}

    let ipA = ipStr;
    if (ipA.indexOf("::ffff:") == 0) {
        ipA = ipA.substring(7);
    }

    if (ipA == "::1" || ipA == "127.0.0.1" || ipA.indexOf("192.168") == 0) {
        return;
    }

    const url = "https://api.ipregistry.co/" + ipA + 
        "?key=" + env.ipLookupKey;

    try {
        console.log("updating ip entry location info with " + url);
        const resp = await fetch(url);
        const ipData = await resp.json();

        const text = `UPDATE ip SET 
            asn = $1, domain = $2, org = $3, route = $4, type = $5, 
            countrycode = $6, country = $7, 
            city = $8, postal = $9, 
            lat = $10, lon = $11, state = $12
            WHERE address = $13
        `;
        const connData = ipData.connection;
        const locData = ipData.location;
        await pool.query(text, [
            connData.asn, connData.domain, connData.organization, connData.route, connData.type,
            locData.country.code, locData.country.name, 
            locData.city, locData.postal, locData.latitude, locData.longitude, locData.region.name,
            ipStr
        ])
    } catch (e) {
        console.log("failed to fetch ip data wtih " + e.toString());
    } 
}

export async function checkIp(ip: string): Promise<number | null> {
    try {
        let text = "SELECT id, domain FROM ip WHERE address = $1";
        let result = await pool.query(text, [ip]);

        if (result.rows.length == 0) {
            console.log("new ip visit " + ip);
            text = "INSERT INTO ip (address, firstVisited) VALUES ($1, $2) RETURNING id";
            result = await pool.query(text, [ip, new Date().getTime()]);
            await ipLookup(ip);

            return result.rows[0].id;
        } else if (!result.rows[0].domain || result.rows[0].domain.length == 0) {
            await ipLookup(ip);
            return result.rows[0].id;
        } else {
            return result.rows[0].id;
        }
    } catch (error) {
        console.error(error);
    }

    return null;
}

export async function checkToken(token: string, ip:string): Promise<number | null> {
    try {
        let text = "SELECT id FROM visitor WHERE token = $1";
        let result = await pool.query(text, [token]);

        let visitorid  = 0;
        if (result.rows.length == 0) {
            console.log("new visitor");
            text = "INSERT INTO visitor (token, updated, created) VALUES ($1, $2, $2) RETURNING id";
            result = await pool.query(text, [token, new Date().getTime()]);
            visitorid = result.rows[0].id;
        } else {
            visitorid = result.rows[0].id;
            text = "UPDATE visitor SET updated = $1 WHERE id = $2";
            await pool.query(text, [new Date().getTime(), visitorid]);
        }

        const ipid = await checkIp(ip);
        
        text = "SELECT visitorid, ipid FROM ip_visitor WHERE visitorid = $1 and ipid = $2";
        result = await pool.query(text, [visitorid, ipid]);

        if (result.rows.length == 0) {
            console.log("new visitor token ip pairing");
            text = "INSERT INTO ip_visitor (visitorid, ipid) VALUES ($1, $2)";
            result = await pool.query(text, [visitorid, ipid]);
        }

        return visitorid;
    } catch (error) {
        console.error(error);
    }

    return null;
}

export interface IPAddress {
    address: string,
    blocked: boolean,
}

export interface UserData {
    commentCount: number,
    flaggedCount: number,
    lastPost: number,
    visitorid: number,
    token: string,
    alias: string,
    updated: number,
    ipAddresses: IPAddress[],
    names: string[],
    isActive: boolean,
    blocked: boolean,
}

export async function getUserData(): Promise<UserData[]> {
    const text = `SELECT c.count, f.flagged, p.lastpost, v.token, v.id as visitorid, v.alias, v.blocked, v.updated
		FROM visitor v
        LEFT OUTER JOIN(SELECT COUNT(visitorid) count, visitorid FROM comment GROUP BY visitorid ORDER BY count DESC) c
			ON (c.visitorid = v.id)
        LEFT OUTER JOIN(SELECT COUNT(id) flagged, visitorid FROM comment WHERE flagged = true GROUP BY visitorid) f ON(f.visitorid = c.visitorid)
        LEFT OUTER JOIN(SELECT MAX(posted) lastpost, visitorid FROM comment GROUP BY visitorid) p ON(p.visitorid = c.visitorid)
        ORDER BY lastpost DESC, token
    `;
    const result = await pool.query(text, []);

    const index = new Map<number, number>()
    const ret:UserData[] = [];
    for (let row of result.rows) {
        const item:UserData = {
            commentCount: row.count,
            flaggedCount: row.flagged,
            lastPost: row.lastpost,
            visitorid: row.visitorid,
            token: row.token,
            alias: row.alias,
            updated: row.updated,
            ipAddresses: [],
            names: [],
            isActive: false,
            blocked: row.blocked
        }

        index.set(item.visitorid, ret.length);
        ret.push(item);
    }

    const names = await getUserNames();
    for (let namePair of names) {
        const idx = index.get(namePair.visitorid);
        if (idx == undefined) {continue}
        const item = ret[idx];
        item.names.push(namePair.name);
    }

    const addresses = await getUserAddresses();
    for (let addressObj of addresses) {
        const idx = index.get(addressObj.id);
        if (idx == undefined) { continue }

        const item = ret[idx];
        item.ipAddresses.push({
            address: addressObj.address, 
            blocked: addressObj.blocked
        });
    }

    return ret;
}

export async function getUserNames(): Promise<{name: string, visitorid: number}[]> {
    const text = `SELECT name, visitorid, MAX(POSTED)
    	FROM comment
    	WHERE visitorid IS NOT NULL
    	GROUP BY visitorid, name
    	ORDER BY max DESC
    `

    const result = await pool.query(text, []);
    return result.rows;
}

export async function getUserAddresses(): Promise<{ address: string, posted: number | null, firstvisited: number, id: number, blocked: boolean }[]> {
    const text = `SELECT v.id, c.posted, i.firstvisited, i.address, i.blocked FROM visitor v
            LEFT OUTER JOIN (SELECT MAX(posted) posted, visitorid FROM comment GROUP BY visitorid) c ON v.id = c.visitorid
            JOIN ip_visitor iv ON iv.visitorid = v.id
            JOIN ip i ON i.id = iv.ipid
    		order by v.id, c.posted, i.firstvisited
    `

    const result = await pool.query(text, []);
    return result.rows;
}

export async function getAlias(after: number = 0):Promise<any[]> {

    const text = `SELECT id as visitorid, alias, updated FROM visitor WHERE updated > $1`;
    try {
        const result = await pool.query(text, [after]);
        return result.rows;
    } catch (e) {
        console.log("get alias failed with " + JSON.stringify(e));
    }

    return [];
}

export async function updateAlias(visitorid: number, alias: string):Promise<number | null> {
    const now = new Date().getTime();
    const text = `UPDATE visitor SET alias = $1, updated = $2 WHERE id = $3`
    try {
        await pool.query(text, [alias, now, visitorid]);
        return now;
    } catch (e) {
        console.log("set alias failed with " + JSON.stringify(e));
    }

    return null;
}

export async function getUrlWhitelist():Promise<string[]> {
    const ret:string[] = [];
    
    try {
        const text = `SELECT pattern FROM url_whitelist`
        const result = await pool.query(text, []);

        for (let line of result.rows) {
            ret.push(line.pattern);
        }

        return ret;
    } catch (e) {
        console.log("fetch url whitelist failed" + JSON.stringify(e));
    }

    return ret;
}

interface Filter {
    id?: number,
    pattern: string,
    replace: string
}

export async function getFilterList():Promise<Filter[]> {
    const ret:Filter[] = [];

    try {
        const text = `SELECT id, pattern, replace FROM filter ORDER BY pattern`
        const result = await pool.query(text, []);

        for (let line of result.rows) {
            ret.push({id: line.id, pattern: line.pattern, replace: line.replace});
        }
    } catch (e) {
        console.log("fetch filter blacklist failed " + JSON.stringify(e));
    }

    return ret;
}

export async function addFilter(args: Filter) {
    try {
        const text = `INSERT INTO filter (pattern, replace) VALUES ($1, $2)`;
        await pool.query(text, [args.pattern, args.replace]);
    } catch (e) {
        console.log("failed to insert filter " + JSON.stringify(e));
    }
}

export async function updateFilter(args: Filter) {
    try {
        const text = `UPDATE filter SET pattern = $1, replace = $2 WHERE id=$3`;
        await pool.query(text, [args.pattern, args.replace, args.id]);
    } catch (e) {
        console.log("failed to update filter " + JSON.stringify(e));
    }
}

export async function deleteFilter(arg: number) {
    try {
        const text = `DELETE FROM filter WHERE id=$1`;
        await pool.query(text, [arg]);
    } catch (e) {
        console.log("failed to delete filter " + JSON.stringify(e));
    }
}

export async function blockUser(id: number, blocked: boolean) {
    try {
        let text = `UPDATE visitor SET blocked = $2 WHERE id = $1`
        await pool.query(text, [id, blocked]);

        text = `UPDATE comment SET updated = $1 WHERE visitorid = $2`
        const now = new Date().getTime();
        await pool.query(text, [now, id]);
    } catch (e) {
        console.log("failed to block user " + id)
    }
}

export async function blockIP(ip: string, blocked: boolean) {
    try {
        let text = `UPDATE ip SET blocked = $2 WHERE address = $1`
        await pool.query(text, [ip, blocked]);

        text = `UPDATE comment SET updated = $1 FROM (
                	SELECT DISTINCT visitor.id AS visitorid FROM visitor
                	JOIN ip_visitor iv ON iv.visitorid = visitor.id
                	JOIN ip i ON i.id = iv.ipid
                	WHERE i.address = $2
                ) v WHERE comment.visitorid = v.visitorid
            `;
        const now = new Date().getTime();
        await pool.query(text, [now, ip]);
    } catch (e) {
        console.log("failed to block ip " + ip);
    }
}