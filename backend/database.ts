import pkg from 'pg';
import env2 from '../env';
import { response } from 'express';

const env = (env2.default) ? env2.default : env2;

const { Pool } = pkg;

const pool = new Pool(env.dbArgs);

export const getTopComments = async (): Promise<any[]> => {
    try {
        const res = await pool.query("SELECT * FROM comment ORDER BY updated DESC LIMIT 1000");
        return res.rows;
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

export const getRecentComments = async (after: number):Promise<any[]> => {
    try {
        const res = await pool.query("SELECT * FROM comment WHERE updated >= $1 ORDER BY updated DESC LIMIT 1000", [after]);
        return res.rows;
    } catch(err) {
        console.error(err);
        throw new Error("Internal server error");
    }
};


export const getOlderComments = async (before: number): Promise<any[]> => {
    try {
        const res = await pool.query("SELECT * FROM comment WHERE updated < $1 ORDER BY updated DESC LIMIT 1000", [before]);
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

export const createComment = async (comment:string, name: string | null, ip: string, parent:number | null):Promise<CommentEntry | null> => {
    try {
        const now = new Date().getTime();
        const short = comment.substring(0, 400);
        const text = "INSERT INTO comment (parent, posted, updated, comment, name, ip) VALUES ($1, $2, $3, $4, $5, $6)";
        const values = [parent, now, now, short, name, ip];
        const result = await pool.query(text, values);
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

export async function getCommentCount():Promise<CommentCountInfo | null> {
    try {
        const result = await pool.query("SELECT COUNT(id), MIN(updated) FROM comment");
        console.log("count response " + JSON.stringify(result.rows));
        return {min: Number.parseInt(result.rows[0].min), count: Number.parseInt(result.rows[0].count)};
    } catch(error) {
        console.error(error);
        throw new Error("Internal server error");
    }
}