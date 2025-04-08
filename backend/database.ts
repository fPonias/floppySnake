import pkg from 'pg';
import env2 from '../env';
import { response } from 'express';
import MyWebSocket from './websocket';

const env = (env2.default) ? env2.default : env2;

const { Pool } = pkg;

const pool = new Pool(env.dbArgs);

export const getTopComments = async (postid: number): Promise<any[]> => {
    try {
        const res = await pool.query("SELECT * FROM comment WHERE postid = $1 ORDER BY updated DESC LIMIT 1000", [postid]);
        return res.rows;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

export const getRecentComments = async (postid: number, after: number):Promise<any[]> => {
    try {
        const res = await pool.query("SELECT * FROM comment WHERE updated >= $1 AND postid = $2 ORDER BY updated DESC LIMIT 1000", [after, postid]);
        return res.rows;
    } catch(err) {
        console.error(err);
        throw new Error("Internal server error");
    }
};


export const getOlderComments = async (postid: number, before: number): Promise<any[]> => {
    try {
        const res = await pool.query("SELECT * FROM comment WHERE updated < $1 AND postid = $2 ORDER BY updated DESC LIMIT 1000", [before, postid]);
        return res.rows;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }

}

export const getComment = async (id:number): Promise<any> => {
    try {
        const res = await pool.query("SELECT * FROM comment WHERE id = $1", [id]);
        return res.rows[0];
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

export const createComment = async (
    token: string, 
    comment:string, 
    name: string | null,
    postid: number, 
    parent:number | null
):Promise<CommentEntry | null> => {
    try {
        if(!MyWebSocket.instance.isLoggedIn(token)) {
            console.log("invalid user attempted to post comment");
            throw new Error("invalid user attempt to post comment");
        }

        const now = new Date().getTime();

        let text = "SELECT updated FROM comment WHERE ip=$1 ORDER BY updated DESC LIMIT 1"
        let result = await pool.query(text, [token]);
        if (result.rows.length > 0) {
            const diff = now - result.rows[0].updated;
            if (diff < 1000) {
                throw new Error("comment posted too quickly");
            }
        }

        const short = comment.substring(0, 400);
        text = "INSERT INTO comment (parent, posted, updated, comment, name, ip, postid) VALUES ($1, $2, $3, $4, $5, $6, $7)";
        const values = [parent, now, now, short, name, token, postid];
        result = await pool.query(text, values);
        if (result && result.rows) {
            const ret = result.rows[0];

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

export const deleteComment = async (id: number) => {
    try {
        const result = await pool.query("UPDATE comment SET comment = $1, name = $2 WHERE id = $3", ["", "", id])
    } catch (error) {
        console.error(error);
        throw new Error("Internal server error");
    }
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