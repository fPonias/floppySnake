import React, { JSX, useContext, useEffect, useState } from "react";
import CommentEntry from "./CommentEntry";
import { FormComponent } from "./Form";
import { AppContext } from "./App";
// @ts-ignore
import EventEmitter from "reactjs-eventemitter";
import { findHyperlinks } from "./CommentUtil"; 
import env from "../../env"

interface CommentProps {
    comment: CommentEntry,
    onReply?: (id: number) => void,
    onDelete?: (id: number) => void,
    onFlag?: (id: number) => void,
    hasActiveReply?: boolean,
    isExpanded?: boolean,
    onExpanded?: (id: number, expanded: boolean) => void,
    indent?: number,
}

const lyingPrefix = env.api + "/img/";
const lyingImages = [
    lyingPrefix + "lying01.jpg",
    lyingPrefix + "lying02.jpg",
    lyingPrefix + "lying03.jpg",
    lyingPrefix + "lying04.jpg",
    lyingPrefix + "lying05.jpg",
];

const Comment:React.FC<CommentProps> = ({
    comment,
    onReply = () => {},
    onDelete = () => {},
    onFlag = () => {},
    hasActiveReply = false,
    isExpanded = false,
    onExpanded = () => {},
    indent = 0,
}) => {
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
            if (hr == 1) { return "1 minute ago"; }
            else { return hr + " minutes ago" };
        } else if (diff <= day) {
            const dy = Math.floor(diff / hour);
            if (dy == 1) { return "1 hour ago" }
            else { return dy + " hours ago" }
        } else if (diff <= long) {
            const mo = Math.floor(diff / day);
            if (mo == 1) { return "1 day ago" }
            else { return mo + " days ago" }
        } else {
            return "long ago";
        }
    }

    const [isOverFlowing, setIsOverFlowing] = useState<boolean>(false);
    const [messageRef, setMessageRef] = useState<HTMLDivElement | null>(null);
    const appContext = useContext(AppContext);
    const [localComment, setComment] = useState(comment);
    const [time, setTime] = useState("");
    const [lyingIndex, _setLyingIndex] = useState(Math.floor(Math.random() * lyingImages.length));

    function renderReply() {
        if (hasActiveReply) {
            return ( <div className="commentLeft">
                <FormComponent 
                    active={hasActiveReply} 
                    replyTo={localComment}
                />
            </div>)
        }
    }

    useEffect(() => {
        if (!localComment || localComment.id != comment.id) {
            setComment(comment);
        }
    }, [comment, localComment]);

    useEffect(() => {
        EventEmitter.subscribe("commentUpdated", (event: any) => {
            if (event.id != localComment.id) { return }
            const commentBackend = appContext.commentBackend;
            if (!commentBackend) { return; }
            const updatedComment = commentBackend.map.get(comment.id);
            if (!updatedComment) { return; }

            setComment(updatedComment);
        });
    }, [localComment]);

    useEffect(() => {
        if (!messageRef || !messageRef.parentElement) {return;}

        if (messageRef.scrollHeight > messageRef.clientHeight || isExpanded) {
            console.log("found overflowing message " + localComment.id);
            setIsOverFlowing(true);
        } else {
            setIsOverFlowing(false);
        }
    }, [isExpanded, localComment, isOverFlowing, messageRef])

    function updateTime() {
        const newTime = dateToAgo(localComment.posted);
        setTime(newTime);
    }

    useEffect(() => {
        EventEmitter.subscribe("clockTick", (_event: any) => {
            updateTime();
        })

        updateTime();
    }, [localComment]);

    function renderFlaggedContent(isFlagged:Boolean):JSX.Element {
        if (!isFlagged) { return (<></>)}
        const image = lyingImages[lyingIndex];
        return (<img src={image} className="flaggedImage"/>)
    }

    function renderMessageParts(message:string):JSX.Element[] {
        const ret:JSX.Element[] = [];
        const parts = findHyperlinks(message);

        for (let i = 0; i < parts.length; i++) {
            if (i % 2 == 0) {
                const parsed = parts[i].split("\n");
                for (let j = 0; j < parsed.length; j++) {
                    if (j > 0) {
                        ret.push((<br/>));
                    }
                    ret.push((<>{parsed[j]}</>));
                }
            } else {
                ret.push((<a target="_blank" rel="noopener noreferrer" href={parts[i]}>{parts[i]}</a>));
            }
        }
        return ret;
    }

    function renderReplyButton():JSX.Element {
        if (!appContext.allowPosts) return (<></>)
        
        return (
            <div className="reply" onClick={() => { onReply(localComment.id) }}>
                <a>Reply</a>
            </div>
        )
    }

    function renderMessage():JSX.Element {
        let messageClass = "message"
        let link = (<></>)
        if (isOverFlowing) {
            if (isExpanded) { messageClass += " expandedMessage"; }

            if (isExpanded) {
                link = (
                    <a onClick={() => {
                        onExpanded(localComment.id, false);
                    }
                    }>Read less</a>
                )
            } else {
                link = (
                    <a onClick={() => {
                        onExpanded(localComment.id, true)
                    }
                    }>Read more</a>
                )
            }
        }

        const isFlagged = localComment.flagged;

        return (<>
            <div className={messageClass} ref={(ref) => {setMessageRef(ref)}}>
                {renderMessageParts(localComment.comment)}
            </div>
            {link}
            {renderFlaggedContent(isFlagged)}
        </>)
    }

    const name = (localComment.name) ? localComment.name : "anon";
    const visitor = appContext.visitorBackend?.entries.get(localComment.visitorid)
    const alias = (visitor && visitor.alias) ? visitor.alias : undefined;
    
    let nameClass = "name"
    if (alias) { nameClass += " censored"; }

    return (<>
        <div className='comment' key={"comment-" + localComment.id} id={localComment.id.toString()} style={{ marginLeft: indent + "px" }}>
            <div className="commentLeft" style={(localComment.flagged) ? {minHeight: 160} : {}}>
                <div className='header'>
                    <span className={nameClass}>{name}</span>
                    {(alias) ? (<span className='name'>{alias}</span>) : (<></>)}
                    <span className='time'>{time}</span>
                </div>
                {renderMessage()}
                {renderReplyButton()}
            </div>
            {!appContext.adminEnabled ? (<></>) : (<div className="admin">
                <div className="delete" onClick={() => { onDelete(localComment.id) }}>
                    <a>Delete</a>
                </div>
                <div className="flag" onClick={() => { onFlag(localComment.id) }}>
                    <a>Flag</a>
                </div>
            </div>)}
            {renderReply()}
            
        </div>
    </>)
}

export default Comment;