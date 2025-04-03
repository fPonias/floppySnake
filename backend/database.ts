import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: 'floppysnake',
  host: 'localhost',
  database: 'floppysnake',
  password: 'aaAA11!!aa',
  port: 5432,
});

export const getRecentComments = async (after: number | null = null):Promise<any[]> => {
    try {
        if (!after) {
            const res = await pool.query("SELECT * FROM comment ORDER BY updated DESC LIMIT 20");
            return res.rows;
        } else {
            const res = await pool.query("SELECT * FROM comment WHERE updated >= $1 ORDER BY updated DESC", [after]);
            return res.rows;
        }
    } catch (error_1) {
        console.error(error_1);
        throw new Error("Internal server error");
    }
};

export const getComment = async (id:number): Promise<any> => {
    try {
        const res = await pool.query("SELECT * FROM comment WHERE id = $1", [id]);
        return res.rows[0];
    } catch (err) {
        console.error(err);
        throw new Error("Internal server error");
    }
}

export const createComment = async (comment:string, name: string | null, ip: string, parent:number | null):Promise<CommentEntry | null> => {
    try {
        const now = new Date().getTime();
        const text = "INSERT INTO comment (parent, posted, updated, comment, name, ip) VALUES ($1, $2, $3, $4, $5, $6)";
        const values = [parent, now, now, comment, name, ip];
        const result = await pool.query(text, values);
        if (result && result.rows) {
            const ret = result.rows[0];
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
