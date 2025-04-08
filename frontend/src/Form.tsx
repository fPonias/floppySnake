import React, { JSX, useRef, useState } from "react";
import env from "../../env";
import CommentEntry from "./CommentEntry";
import { useCookies } from "react-cookie";
import { CookieValues } from "./defs";


interface FormArgs {
    replyTo?: CommentEntry | undefined,
    active?: boolean,
    postid: number,
    onPosted?: () => void,
    token?: string | null
}

export function FormComponent({
    replyTo = undefined,
    postid,
    active = true,
    onPosted = () => {},
    token = null
}:FormArgs):JSX.Element {
    const [comment, setComment] = useState<string>("");
    const form = useRef<HTMLFormElement | null>(null); 
    const [cookies, setCookie] = useCookies<"name", CookieValues>(["name"]);

    async function postComment(evt:React.MouseEvent) {
        evt.preventDefault();

        const url = env.api + "/comment";
        let args = {
            comment: comment,
            name: cookies.name,
            postid: postid,
            parent: (replyTo) ? replyTo.id : null,
            token: token
        };

        const body = JSON.stringify(args);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body
            });

            console.log("fetched " + JSON.stringify(res));

            setComment("");

            onPosted();
        } catch (e) {
            console.log("failed to post comment " + JSON.stringify(e));
        }
    }

    function validateAndSetName(evt: React.ChangeEvent<HTMLInputElement>) {
        const newValue = evt.target.value;

        if (newValue.length > 32) {
            return;
        }

        setCookie("name", newValue);
    }

    function validateAndSetComment(evt: React.ChangeEvent<HTMLTextAreaElement>) {
        const newValue = evt.target.value;

        if (newValue.length > 4096) {
            return;
        }

        setComment(newValue);
    }

    if (!active) {
        return (<></>);
    }

    return (<>
        <form id="postForm" ref={(ref) => { form.current = ref; }}>
            <div className="input">
                <div className="label">Name: </div>
                <input className="formItem"
                    name='name' value={cookies.name}
                    onChange={(evt) => { validateAndSetName(evt) }}
                />
            </div>
            <div className='input'>
                <div className="label">
                    Comment:<br />
                    <span className='sublabel'>({comment.length} / 400)</span>
                </div>
                <textarea name='comment' className='formItem'
                    value={comment}
                    onChange={(evt) => { validateAndSetComment(evt) }}
                ></textarea>
            </div>
            <div>
                <button onClick={(evt) => { postComment(evt) }} style={{marginRight: "20px"}}>Post</button>
            </div>
        </form>
    </>)
}
