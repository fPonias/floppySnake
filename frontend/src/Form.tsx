import React, { JSX, useContext, useRef, useState } from "react";
import env from "../../env";
import CommentEntry from "./CommentEntry";
import { useCookies } from "react-cookie";
import { CookieValues } from "./defs";
import { AppContext } from "./App";


interface FormArgs {
    replyTo?: CommentEntry | undefined,
    active?: boolean,
    onPosted?: () => void,
    onAdminEnabled?: (enabled: boolean) => void,
}

export function FormComponent({
    replyTo = undefined,
    active = true,
    onAdminEnabled = (_) => {}
}: FormArgs): JSX.Element {
    const appContext = useContext(AppContext);
    const [comment, setComment] = useState<string>(appContext.activeReply?.comment ?? "");
    const form = useRef<HTMLFormElement | null>(null); 
    const [cookies, setCookie] = useCookies<"name", CookieValues>(["name"]);
    const [adminTaps, setAdminTaps] = useState<number>(0);
    const nameLabel = useRef<HTMLDivElement | null>(null);
    const commentLabel = useRef<HTMLDivElement | null>(null);

    async function postComment(evt:React.MouseEvent) {
        evt.preventDefault();

        const url = env.api + "/comment";
        const postid = appContext.commentBackend?.postid ?? 0
        const token = appContext.apiToken
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

            appContext.onPosted();
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
        const activeReply = appContext.activeReply;
        if (activeReply) {
            activeReply.comment = newValue;
        }
    }

    if (!active) {
        return (<></>);
    }

    function onAdminTap(target:HTMLDivElement | null) {
        switch(adminTaps) {
            case 0:
            case 2:
            case 4:
                if (target == nameLabel.current) {
                    setAdminTaps(adminTaps + 1);
                } else {
                    setAdminTaps(0);
                }
                break;
            case 1:
            case 3:
                if (target == commentLabel.current) {
                    setAdminTaps(adminTaps + 1);
                } else {
                    setAdminTaps(0);
                }
                break;
        }

        if (adminTaps == 5) {
            setAdminTaps(0);
            onAdminEnabled(true);
        }
    }

    return (<>
        <form id="postForm" ref={(ref) => { form.current = ref; }}>
            <div className="input">
                <div className="label" ref={(ref) => {nameLabel.current = ref}} onClick={() => {onAdminTap(nameLabel.current)}}>Name: </div>
                <input className="formItem"
                    name='name' value={cookies.name}
                    onChange={(evt) => { validateAndSetName(evt) }}
                />
            </div>
            <div className='input'>
                <div className="label" ref={(ref) => { commentLabel.current = ref }} onClick={() => { onAdminTap(commentLabel.current) }}>
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
