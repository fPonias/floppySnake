import pkg from 'pg';
import env2 from '../env';
import { response } from 'express';
import MyWebSocket from './websocket';
import { GibberishInstance } from './Gibberish';
import Anthropic from '@anthropic-ai/sdk';
import { enqueueAssistResponse as _enqueueAssistResponse, initializeChatbots, setDirectCommentFn } from './chatbots';

// Re-export for routing
export const enqueueAssistResponse = _enqueueAssistResponse;

const env = (env2.default) ? env2.default : env2;

const { Pool } = pkg;

const pool = new Pool(env.dbArgs);

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: env.anthropicKey,
});

export const getTopPost = async (matches: String): Promise<any> => {
    try {
        const res = await pool.query(`SELECT * FROM post WHERE url LIKE %$1% ORDER BY id DESC LIMIT 1`, [matches]);
        return res.rows[0];
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

const commentQuery = `
    SELECT comment.* FROM comment
`

const commentLimit = 100

export const getTopComments = async (postid: number): Promise<any[]> => {
    try {
        const res = await pool.query(`${commentQuery} WHERE postid = $1 ORDER BY id DESC LIMIT ${commentLimit}`, [postid]);
        return res.rows;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

export const getAllComments = async (count: number): Promise<any[]> => {
    try {
        const res = await pool.query(`${commentQuery} ORDER BY id DESC LIMIT $1`, [count]);
        return res.rows;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

const gibberishSprinkles = [
    "Hi Snek!  Welcome back!",
    "Hey everyone.  PN's biggest fan is back.",
    "Stalking against police orders",
    "How's the real estate business going?",
    "Done anything lately?",
    "Still a loser?",
    "Have you made your 1000 comment quota?",
    "What an achievement.",
    "Go crawl in a bottle son.  You deserve a little treat for all that hard work.",
    "I'd piss on you but Tavonya has that covered.",
    "I'll shit in your mouth instead.",
];

const repeat = [
    "Snek is a stalker",
    "Snek is a loser",
    "Snek is a pedophile",
    "Snek is trash",
    "Snek is a racist",
    "Snek is a gay homophobe",
    "Snek hates women",
    "Snek is old",
    "Snek hates himself",
    "Snek is a moron",
]

export const getTopGibberishComments = async (postid: number): Promise<any[]> => {
    try {
        const ret = await getAllComments(1000);
        for (let i = 0; i < ret.length; i++) {
            let row = ret[i];
            const gibberish = GibberishInstance.getComment(row.id);

            if (!gibberish) { throw new Error("Could not received Gibberish " + row.id) }

            if (i / 5 >= gibberishSprinkles.length) {
                const idx = i % repeat.length
                row.name = "Real Snake";
                row.comment = repeat[idx];
                row.original = gibberish.message;
            } else if (i % 5 != 0 ) {
                row.name = gibberish.name;
                row.comment = gibberish.message;
                row.original = "";
            } else {
                row.name = gibberish.name;
                row.comment = gibberishSprinkles[i / 5];
                row.original = "";
            }
        }

        return ret;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

export const getRecentComments = async (postid: number, after: number): Promise<any[]> => {
    try {
        const res = await pool.query(`${commentQuery} WHERE updated >= $1 AND postid = $2 ORDER BY updated DESC LIMIT ${commentLimit}`, [after, postid]);
        return res.rows;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
};


export const getRecentGibberishComments = async (postid: number, after: number): Promise<any[]> => {
    try {
        const ret = await getRecentComments(postid, after);
        for (let row of ret) {
            const gibberish = GibberishInstance.getComment(row.id);
            row.name = gibberish.name;
            row.comment = gibberish.message;
            row.original = "";
        }
        return ret;
    } catch (err) {
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

export const getOlderGibberishComments = async (postid: number, before: number): Promise<any[]> => {
    try {
        const ret = await getOlderComments(postid, before);
        for (let row of ret) {
            const gibberish = GibberishInstance.getComment(row.id);
            row.name = gibberish.name;
            row.comment = gibberish.message;
            row.original = "";
        }
        return ret;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }

}

export const getUserComments = async (ids:number[], isAuthorized:boolean): Promise<any[]> => {
    try {
       let text = 'SELECT * FROM comment WHERE ';
       if (!isAuthorized) {
        text += 'bestof = true AND ';
       }
       text += 'visitorid IN (' + ids.join(',') + ') ORDER BY posted ASC';

       const result = await pool.query(text, []);
       console.log("found " + result.rows.length + " matching comments");
       return result.rows;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

export const getComment = async (id: number): Promise<any> => {
    try {
        const res = await pool.query(`${commentQuery} WHERE comment.id = $1`, [id]);
        return res.rows[0];
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

export const getCommentGibberish = async (id: number): Promise<any> => {
    try {
        const ret = await getComment(id);
        const gibberish = GibberishInstance.getComment(ret.id);
        if (!gibberish) { throw new Error("Internal server error") }

        ret.name = gibberish.name;
        ret.comment = gibberish.message;
        ret.original = "";
        return ret;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

export const flagComment = async (id: number): Promise<any> => {
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
        //console.log("updating parent " + id);
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

async function assembleYouTubeData(str: string, id: string): Promise<previewData | null> {
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

async function parseYouTube(str: string): Promise<previewData | null> {
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
            if (str.indexOf(youtube[j]) == 8) {
                console.log("matched host " + youtube[j])
                const str2 = str.substring(8 + youtube[j].length);
                const ret: previewData | null = await parseYouTube(str2);

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
    comment: string,
    name: string | null,
    postid: number,
    parent: number | null,
    original: string | null,
):Promise<number> => {
    try {
        if (!MyWebSocket.instance.isLoggedIn(token)) {
            console.log("invalid user attempted to post comment");
            throw new Error("invalid user attempt to post comment");
        }

        const now = new Date().getTime();

        let text = `SELECT updated, created, blocked FROM visitor WHERE visitor.token=$1`;
        let result = await pool.query(text, [token]);
        if (result.rows.length == 0) {
            throw new Error("invalid user posted");
        }

        const blocked = result.rows[0].blocked;
        let diff = now - result.rows[0].updated;
        if (diff < 1000) {
            throw new Error("comment posted too quickly");
        }

        diff = now - result.rows[0].created;
        console.log("user create diff " + diff);
        if (diff < 12000) {
            throw new Error("new user posted too quickly");
        }

        text = `UPDATE visitor SET updated = $1 WHERE token = $2`;
        await pool.query(text, [new Date().getTime(), token]);

        text = `SELECT id FROM visitor WHERE token = $1`
        result = await pool.query(text, [token]);

        return await directComment(comment, name, postid, parent, original, result.rows[0].id, now);
    } catch (error_1) {
        console.error(error_1);
        throw new Error("Internal server error");
    }
}

const directComment = async (
    comment: string,
    name: string | null,
    postid: number,
    parent: number | null,
    original: string | null,
    visitorid: string,
    now: number,
): Promise<number> => {
    try {
        const thumbDets = await getThumbDets(comment);

        const short = comment.substring(0, 400);
        let text = `INSERT INTO comment (parent, name, posted, updated, comment, postid, original, flagged, visitorid)
                VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
            `;
        const values = [parent, name, now, now, short, postid, original ?? "", false, visitorid];
        let result = await pool.query(text, values);
        if (result && result.rows) {
            const ret = result.rows[0];

            if (thumbDets != null) {
                text = `UPDATE comment SET thumbnail = $1, thumbTitle = $2 WHERE id = $3`
                await pool.query(text, [thumbDets.imageUrl, thumbDets.title, ret.id]);
            }

            //if (blocked) {
            //    const gib = GibberishInstance.getComment(ret.id);
            //    text = `UPDATE comment SET name = $1, comment = $2 WHERE id = $3`
            //    await pool.query(text, [gib.name, gib.message, ret.id]);
            //}

            if (parent != null) {
                await updateParent(parent, now);
            }

            return ret["id"];
        } else {
            throw new Error("Comment creation failed");
        }
    } catch (error_1) {
        console.error(error_1);
        throw new Error("Internal server error");
    }
}

// Initialize chatbots with dependencies
initializeChatbots(pool, anthropic);
setDirectCommentFn(directComment);

export const deleteComment = async (id: number): Promise<number | null> => {
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

export async function getCommentCount(postid: number): Promise<CommentCountInfo | null> {
    try {
        const result = await pool.query("SELECT COUNT(id), MIN(updated) FROM comment WHERE postid = $1", [postid]);
        console.log("count response " + JSON.stringify(result.rows));
        return { min: Number.parseInt(result.rows[0].min), count: Number.parseInt(result.rows[0].count) };
    } catch (error) {
        console.error(error);
        throw new Error("Internal server error");
    }
}

export async function getPost(url: string): Promise<number | null> {
    try {
        const result = await pool.query("SELECT id FROM post WHERE url = $1", [url]);

        if (result.rows.length > 0) {
            return result.rows[0].id;
        } else {
            return null;
        }
    } catch (error) {
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

async function ipLookup(ipStr: string) {
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

export async function syncIps() {
    try {
        let text = "SELECT id, address FROM ip WHERE domain IS NULL";
        let result = await pool.query(text, []);
        for (let row of result.rows) {
            await ipLookup(row.address);
        }
    } catch (error) {
        console.error(error);
    }
}

export async function checkToken(token: string, ip: string): Promise<number | null> {
    try {
        let text = "SELECT id FROM visitor WHERE token = $1";
        let result = await pool.query(text, [token]);

        let visitorid = 0;
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

        const id = await checkIp(ip);
        const ipid = id;

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
    domain: string,
    countryCode: string,
    city: string,
    state: string,
}

export interface UserData {
    commentCount: number,
    flaggedCount: number,
    lastPost: number,
    lastComment: {name: string, comment: string} | null,
    visitorid: number,
    token: string,
    alias: string,
    updated: number,
    ipAddresses: IPAddress[],
    users: SubUserData[],
    names: string[],
    isActive: boolean,
}

export interface SubUserData {
    visitorid: number,
    token: string,
    updated: number,
    blocked: boolean,
    created: number | null,
    allowed: boolean,
}

export async function getRecentUserData(start: number): Promise<UserData[]> {
    console.log('fetching userdata from ' + start);
    let text = `SELECT id FROM visitor 
        WHERE updated >= $1
    `;

    //console.log("fetching user ids with " + text + " - " + start);
    let result = await pool.query(text, [start]);

    const ids: string[] = [];
    for (let row of result.rows) {
        ids.push(row.id);
    }

    return getExtendedUserData(ids)
}

export async function getExtendedUserData(ids: string[]): Promise<UserData[]> {
    
    let text = `SELECT * FROM visitor 
        WHERE visitor.id IN (${ids.join(',')})
        ORDER BY updated DESC
    `;

    //console.log("fetching user ids with " + text + " - " + start);
    let result = await pool.query(text);

    const userMap: Map<number, UserData> = new Map();
    for (let row of result.rows) {
        const item: UserData = {
            visitorid: row.id,
            token: row.token,
            alias: row.alias,
            updated: row.updated,
            commentCount: 0,
            flaggedCount: 0,
            lastPost: 0,
            
            ipAddresses: [],
            users: [],
            names: [],
            isActive: false,
            lastComment: null,
        }

        ids.push(row.id);
        userMap.set(row.id, item);
    }

    const collatedUserData = await getRelatedUsersAndAddressesByIds(ids);
    const subUsersIndex: Map<number, number> = new Map();
    for (let row of collatedUserData) {
        const item = userMap.get(row.origid);
        if (!item) { continue; }

        if (!subUsersIndex.has(row.id)) {
            item.users.push({
                visitorid: row.id,
                token: row.token,
                blocked: row.vblocked,
                created: row.created,
                updated: row.updated,
                allowed: row.allowed
            });
        }

        const idx = item.ipAddresses.findIndex((ipData) => { return ipData.address == row.address });
        if (idx == -1 || idx == undefined) {
            item.ipAddresses.push({
                address: row.address,
                blocked: row.iblocked,
                domain: row.domain,
                countryCode: row.countrycode,
                city: row.city,
                state: row.state,
            });
        } else if (item.ipAddresses[idx].domain != row.domain) {
            item.ipAddresses[idx].domain = row.domain;
            item.ipAddresses[idx].countryCode = row.countrycode;
            item.ipAddresses[idx].city = row.city;
            item.ipAddresses[idx].state = row.state;
        }

        subUsersIndex.set(row.id, row.origid);
    }



    text = `SELECT c.count, f.flagged, p.*, v.id as visitorid
		FROM visitor v
        LEFT OUTER JOIN(SELECT COUNT(visitorid) count, visitorid FROM comment GROUP BY visitorid ORDER BY count DESC) c
			ON (c.visitorid = v.id)
        LEFT OUTER JOIN(SELECT COUNT(id) flagged, visitorid FROM comment WHERE flagged = true GROUP BY visitorid) f ON(f.visitorid = c.visitorid)
        LEFT OUTER JOIN(
			SELECT comment.id, comment.name, comment.comment, m.* FROM comment JOIN (
				SELECT MAX(posted) lastpost, visitorid FROM comment GROUP BY visitorid
			) m ON comment.visitorid = m.visitorid AND comment.posted = m.lastpost
		) p ON (p.visitorid = c.visitorid)
		WHERE count IS NOT NULL
        ORDER BY lastpost DESC, token
    `;
    //console.log("stats " + text);
    result = await pool.query(text, []);

    for (let row of result.rows) {
        const key = subUsersIndex.get(row.visitorid);
        if (!key) { continue; }
        const item = userMap.get(key);
        if (!item) { continue; }

        if (row.count != null) {
            item.commentCount += Number.parseInt(row.count);
        }
        if (row.flagged != null) {
            item.flaggedCount += Number.parseInt(row.flagged);
        }

        let lastPost = (row.lastPost != null) ? Number.parseInt(row.lastPost) : 0;
        if (lastPost > item.lastPost) {
            item.lastPost = lastPost;
        }

        if (row.name != null && row.comment != null) {
            item.lastComment = {name: row.name, comment: row.comment};
        }
    }

    const names = await getUserNames();
    for (let namePair of names) {
        if (namePair.name == null || namePair.name.trim().length == 0 ||
            namePair.name == "[deleted]"
        ) {
            continue
        }

        const key = subUsersIndex.get(namePair.visitorid);
        if (!key) { continue; }
        const item = userMap.get(key);
        if (!item) { continue; }

        const trimmed = namePair.name.trim().toLowerCase();
        const idx = item.names.findIndex((value) => {
            const mod = value.trim().toLowerCase();
            return mod == trimmed
        });
        if (idx == -1) {
            item.names.push(namePair.name);
        }
    }

    const userList: UserData[] = [];
    for (let id of userMap.keys()) {
        const user = userMap.get(id);
        if (!user) { continue; }
        if (user.ipAddresses.length == 0 && user.users.length == 0) { continue; }
        userList.push(user);
    }
    return userList;
}

export async function getUserNames(): Promise<{ name: string, visitorid: number }[]> {
    const text = `SELECT name, visitorid, MAX(POSTED)
    	FROM comment
    	WHERE visitorid IS NOT NULL
    	GROUP BY visitorid, name
    	ORDER BY max DESC
    `

    const result = await pool.query(text, []);
    return result.rows;
}

interface UserAddress {
    address: string,
    posted: number | null,
    firstvisited: number,
    id: number,
    blocked: boolean,
    domain: string,
    countryCode: string,
    city: string,
    state: string,
}

export enum BlackListType {
    NEW_USER,
    REQUESTED,
    BLOCKED,
    PERMITTED,
};

export const BlackListTypeString = new Map<BlackListType, string>();
BlackListTypeString.set(BlackListType.BLOCKED, "blocked");
BlackListTypeString.set(BlackListType.NEW_USER, "new user");
BlackListTypeString.set(BlackListType.REQUESTED, "requested");
BlackListTypeString.set(BlackListType.PERMITTED, "permitted");

export async function getUserToken(id: number):Promise<string> {
    const line = `select token from visitor WHERE id = $1`;
    const result = await pool.query(line, [id]);

    return result.rows[0].token;
}

export async function isUserBlacklisted(token:string):Promise<BlackListType> {
    //return BlackListType.PERMITTED;

    const related = await getRelatedUsersAndAddressesByToken(token);

    if (related.length == 0) {
        return BlackListType.NEW_USER;
    }

    let allowed = false;
    let count:number = 0;

    for (let i = 0; i < related.length; i++) {
        if (related[i].vblocked) {
            console.log("user " + token + " matched visitor blacklist " + JSON.stringify(related[i]))
            //return BlackListType.BLOCKED;
        }

        if (related[i].iblocked) {
            console.log("user " + token + " matched ip blacklist " + JSON.stringify(related[i]))
            //return BlackListType.BLOCKED;
        }

        if (related[i].countrycode != null && related[i].countrycode != 'US' && related[i].countrycode != 'GB') {
            console.log("user " + token + " matched out of country ISP " + JSON.stringify(related[i]))
            //return BlackListType.BLOCKED;
        }

        if (related[i].allowed == true) {
            allowed = true;
        }

        if (related[i].count != null) {
            count += Number.parseInt(related[i].count);
        }
    }

    if (count == 0) {
        return BlackListType.NEW_USER;
    } 
    
    console.log("visitor " + related[0].origid + " has " + count + " related posts");
    if (count == 1 && !allowed) {
        return BlackListType.REQUESTED;
    } else if (!allowed) {
        return BlackListType.BLOCKED;
    }

    return BlackListType.PERMITTED;
}

export async function getUsers(): Promise<any[]> {
    const text = `SELECT * FROM visitor`;
    const result = await pool.query(text, []);
    return result.rows;
}

export async function getRelatedUsersAndAddressesByWhere(where: string): Promise<any[]> {
    const text = `SELECT DISTINCT visitor.id as visitorid, visitor.*, ip.* FROM
        	(SELECT visitor.id vid, ip.id iid
        		FROM visitor
        		JOIN (
        			SELECT iv.* FROM ip_visitor iv JOIN (
        				SELECT DISTINCT(iv.ipid) FROM ip_visitor iv JOIN (
        					SELECT iv.visitorid FROM ip_visitor iv
        					JOIN ip ON ip.id = iv.ipid
        						WHERE ${where}
        				) v ON v.visitorid = iv.visitorid
        			) i ON i.ipid = iv.ipid
        		) iv ON iv.visitorid = visitor.id
        		JOIN ip ON ip.id = iv.ipid
        	) ids 
        JOIN ip ON ip.id = ids.iid
        JOIN visitor ON visitor.id = ids.vid
    `;

    //console.log ("running " + text);
    const result = await pool.query(text, []);
    return result.rows;
}

export async function getRelatedUsersAndAddressesByIds(ids: string[]): Promise<any[]> {
    if (ids.length == 0) {
        return [];
    }

    const text = `SELECT DISTINCT visitor_loopback.* FROM visitor_loopback WHERE
    visitor_loopback.origid IN (${ids.join(',')})
    `;

    //console.log("related users with " + text);
    const result = await pool.query(text, []);
    return result.rows;
}

export async function getRelatedUsersAndAddressesByToken(token: string): Promise<any[]> {
    const text = `SELECT DISTINCT visitor_loopback.*, COALESCE(cnt, 0) count FROM visitor_loopback 
LEFT OUTER JOIN (SELECT COUNT(id) cnt, visitorid FROM comment GROUP BY visitorid) cnt ON visitor_loopback.id = cnt.visitorid
WHERE origtoken = $1
    `;

    const result = await pool.query(text, [token]);
    return result.rows;
}

export async function getRelatedUsersAndAddresses(ip: string): Promise<any[]> {
    const text = `SELECT DISTINCT visitor_loopback.* FROM visitor_loopback WHERE origid = $1
    `;

    const result = await pool.query(text, [ip]);
    return result.rows;
}

export async function getAlias(after: number = 0): Promise<any[]> {

    const text = `SELECT id as visitorid, alias, updated FROM visitor WHERE updated > $1`;
    try {
        const result = await pool.query(text, [after]);
        return result.rows;
    } catch (e) {
        console.log("get alias failed with " + JSON.stringify(e));
    }

    return [];
}

export async function updateAlias(visitorid: number, alias: string): Promise<number | null> {
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

export async function getUrlWhitelist(): Promise<string[]> {
    const ret: string[] = [];

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

export async function getFilterList(): Promise<Filter[]> {
    const ret: Filter[] = [];

    try {
        const text = `SELECT id, pattern, replace FROM filter ORDER BY pattern`
        const result = await pool.query(text, []);

        for (let line of result.rows) {
            ret.push({ id: line.id, pattern: line.pattern, replace: line.replace });
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

export async function allowUsers(ids: number[], allow: boolean) {
    try {
        let idStr = ""
        for (let id of ids) {
            if (idStr.length == 0) {
                idStr += id;
            } else {
                idStr += "," + id;
            }
        }

        let text = `UPDATE visitor SET allowed = $1 WHERE id IN (${idStr})`
        await pool.query(text, [allow]);

        text = `UPDATE comment SET updated = $1 WHERE visitorid IN (${idStr})`
        const now = new Date().getTime();
        await pool.query(text, [now]);
    } catch (e) {
        console.log("failed to allow user " + ids + " with " + e);
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
        console.log("failed to block user " + id + " with " + e)
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

export async function getIPs(): Promise<any[]> {
    //runs for several seconds
    //don't abuse this function
    try {
        let text = `SELECT DISTINCT
                v.origid, visitor.id, visitor.token, visitor.blocked vblocked,
                    visitor.created, visitor.allowed,
                    ip.firstvisited, ip.domain, ip.address, ip."state",
                        ip.city, ip.countrycode, ip.blocked iblocked,
                        ip.lat, ip.lon
        	FROM visitor
                JOIN(
                    SELECT iv.*, i.origid FROM ip_visitor iv JOIN(
                        SELECT iv.ipid, v.origid FROM ip_visitor iv JOIN(
                            SELECT iv.visitorid, v.id origid FROM ip_visitor iv
        				JOIN visitor v ON v.id = iv.visitorid
                        ) v ON v.visitorid = iv.visitorid
                    ) i ON i.ipid = iv.ipid
                ) v ON v.visitorid = visitor.id
        	JOIN ip ON v.ipid = ip.id
        	ORDER BY origid, visitor.id DESC
        `;
        const result = await pool.query(text, []);
        return result.rows;
    } catch (e) {
        console.log("failed to get ip info");
    }

    return [];
}

export async function getComments(): Promise<any[]> {
    try {
        let text = `SELECT comment.visitorid, posted, name, comment, ip.*
            FROM comment
            JOIN visitor v ON v.id = comment.visitorid
            JOIN (SELECT MIN(ipid) ipid, visitorid FROM ip_visitor GROUP BY visitorid) iv ON iv.visitorid = v.id
            JOIN ip ON iv.ipid = ip.id
            WHERE comment.visitorid IS NOT NULL 
            ORDER BY posted ASC
        `;
        const result = await pool.query(text, []);
        return result.rows;
    } catch (e) {
        console.log("failed to get comments");
    }

    return [];
}

export async function markCommentBestOf(id: number, bestof: boolean) {
    try {
        let text = `UPDATE comment SET bestof = $1 WHERE id = $2`;
        const result = await pool.query(text, [bestof, id]);
    } catch (e) {
        console.log("failed to update comment best of");
    }
}
