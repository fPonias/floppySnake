import React, { JSX, useRef, useState } from "react";
import { api } from "./env";
import CommentEntry from "./CommentEntry";

interface FormArgs {
    replyTo?: CommentEntry | undefined,
    active?: boolean,
    onPosted?: () => void
}

export function FormComponent({
    replyTo = undefined, 
    active = true,
    onPosted = () => {}
}:FormArgs):JSX.Element {
    const [name, setName] = useState<string>("");
    const [comment, setComment] = useState<string>("");
    const form = useRef<HTMLFormElement | null>(null);

    async function postComment(evt:React.MouseEvent) {
        evt.preventDefault();

        const url = api + "/comment";
        let args = {
            comment: comment,
            name: name,
            parent: (replyTo) ? replyTo.id : null,
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

        setName(newValue);
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
                    name='name' value={name}
                    onChange={(evt) => { validateAndSetName(evt) }}
                />
            </div>
            <div className='input'>
                <div className="label">
                    Comment:<br />
                    <span className='sublabel'>({comment.length} / 4000)</span>
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