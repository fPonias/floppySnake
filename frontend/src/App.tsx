import React, { JSX, useRef, useState } from 'react'
import './App.css'
import useMount from './useMount';
import { FormComponent } from './Form';
import CommentEntry, { CommentEntries } from './CommentEntry';
import useWebSocket from 'react-use-websocket';
import env from '../../env'
import { WebSocketHook } from 'react-use-websocket/dist/lib/types';

function App() {
    const [comments, setComments] = useState<CommentEntry[]>([]);
    const [activeReply, setActiveReply] = useState<number | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const commentBackend = useRef<CommentEntries | null>(null);
    const ws = useRef<WebSocketHook | undefined>(undefined)

    ws.current = useWebSocket(env.socketUrl, {
        onOpen: () => console.log('opened'),
        shouldReconnect: (closeEvent) => true,
        share: true,
        onMessage: (evt) => {
            console.log("received message " + JSON.stringify(evt.data));

            const data = JSON.parse(evt.data);
            const postid = data.postid;
            const date = data.updated;
            const commentBack = commentBackend.current;

            if (!commentBack) { return; }

            if (postid == commentBack.postid && date > commentBack.newest) {
                doUpdate();
            }
        },
    });

    useMount(() => {
        setLoading(true);
        if (commentBackend.current == null || commentBackend.current.url != document.URL) {
            commentBackend.current = new CommentEntries(document.URL);
        }

        firstLoad().then(() => {
            setLoading(false)
        });
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

    async function firstLoad() {
        await commentBackend.current?.getPost();
        await commentBackend.current?.getRecent();
        await commentBackend.current?.sortTree();
        setComments(commentBackend.current?.tree ?? []);
        setActiveReply(undefined);
    }

    async function doUpdate() {
        await commentBackend.current?.getNewest();
        await commentBackend.current?.sortTree();
        setComments(commentBackend.current?.tree ?? []);
        setActiveReply(undefined);
    }

    async function loadMore() {
        await commentBackend.current?.getOlder()
        await commentBackend.current?.sortTree();
        setComments(commentBackend.current?.tree ?? []);
    }

    function renderReply(comment: CommentEntry) {
        if (activeReply == comment.id) {
            return (
                <FormComponent active={comment.id == activeReply} postid={commentBackend.current?.postid ?? 0} replyTo={comment}/>
            )
        }
    }

    function renderLoadMore() {
        const count = commentBackend.current?.count ?? 0;
        const map = commentBackend.current?.map;
        const mapSz = map?.size ?? 0;
        if (count > mapSz) {
            return (
                <a onClick={() => {loadMore()}}>More ...</a> 
            )
        } else {
            return (<></>)
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
                    <div className='comment' key={comment.id} style={{ marginLeft: indent + "px" }}>
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
        <FormComponent postid={commentBackend.current?.postid ?? 0}/>
        <div className='comments'>
            {renderComments(0, comments)}
            {renderLoadMore()}
        </div>
    </>)
}

export default App
