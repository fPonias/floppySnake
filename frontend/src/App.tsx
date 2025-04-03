import React, { JSX, useState } from 'react'
import './App.css'
import useMount from './useMount';
import { FormComponent } from './Form';
import CommentEntry, { CommentEntries } from './CommentEntry';

function App() {
    const [comments, setComments] = useState<CommentEntry[]>([]);
    const [activeReply, setActiveReply] = useState<number | undefined>(undefined);
    const [loading, setLoading] = useState(false);

    useMount(() => {
        setLoading(true);
        doUpdate().then(() => {setLoading(false)})
    });

    function dateToAgo(date: number): string {
        const min = 60;
        const hour = min * 60;
        const day = hour * 24;
        const long = day * 30;

        const now = new Date().getTime();
        const diff = Math.max(0, now - date) / 1000;
        
        if (diff <= 15) {
            return "just now";
        } else if (diff <= min) {
            return Math.floor(diff) + " seconds ago";
        } else if (diff <= hour) {
            const hr = Math.floor(diff / min);
            return hr + " minutes ago";
        } else if (diff <= day) {
            const dy = Math.floor(diff / hour);
            return dy + " hours ago"; 
        } else if (diff <= long) {
            const mo = Math.floor(diff / day);
            return mo + " days ago";
        } else {
            return "long ago";
        }
    }

    function replyClicked(evt: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        const idStr = evt.currentTarget.id;
        const id = Number.parseInt(idStr);

        if (id == activeReply) {
            setActiveReply(undefined);
        } else {
            setActiveReply(id);
        }
    }

    async function doUpdate() {
        await CommentEntries.instance.getRecent();
        await CommentEntries.instance.sortTree();
        setComments(CommentEntries.instance.tree);
    }

    function renderReply(comment: CommentEntry) {
        if (activeReply == comment.id) {
            return (
                <FormComponent active={comment.id == activeReply} replyTo={comment} onPosted={() => {doUpdate();}}/>
            )
        }
    }

    function renderComments(depth: number, commentsList: CommentEntry[]):JSX.Element {
        if(commentsList.length == 0) {return (<></>)}

        const indent = depth * 20;
        return (<>
            {commentsList.map((comment) => {
                const time = dateToAgo(comment.posted);
                const name = (comment.name) ? comment.name : "anonymous coward";
                return (<>
                    <div className='comment' style={{ marginLeft: indent + "px" }}>
                        <div className='header'><span className='name'>{name}</span><span className='time'>{time}</span></div>
                        <div className='message'><pre>{comment.comment}</pre></div>
                        <div className="reply" id={comment.id.toString()} onClick={(evt) => { replyClicked(evt) }}>
                            <a>Reply</a>
                        </div>
                        {renderReply(comment)}
                    </div>
                    {renderComments(depth + 1, comment.children)}
                </>)
            })}
        </>);
    }

    if (loading) {
        return (<div>Loading ...</div>)
    }

    return (<>
        <FormComponent onPosted={() => { doUpdate(); }} />
        <div className='comments'>
            {renderComments(0, comments)}
        </div>
    </>)
}

export default App
