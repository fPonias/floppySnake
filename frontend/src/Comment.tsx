import React, { JSX, useCallback, useContext, useEffect, useState } from "react";
import CommentEntry from "./CommentEntry";
import { FormComponent } from "./Form";
import { AppContext } from "./App";
// @ts-ignore
import EventEmitter from "reactjs-eventemitter";
import { findHyperlinks } from "./CommentUtil";
import { UserDetails } from "./AdminMain";
import { getStickerIndex, Stickers } from "./Sticker";
import { SubUserData } from "./AdminTools";

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
    const [stickerIndex, setStickerIndex] = useState<number>(0);

    const updateSticker = useCallback((comment:CommentEntry) => {
        if (comment.flagged) {
            if (!appContext.stickerIndex.has(comment.id)) {
                const sz = appContext.stickerIndex.size;
                appContext.stickerIndex.set(comment.id, sz);
            }

            const index = appContext.stickerIndex.get(comment.id) ?? 0;
            setStickerIndex(getStickerIndex(index));
        }
    }, [appContext.stickerIndex]);

    useEffect(() => {
        updateSticker(comment)
    }, [comment, appContext.stickerIndex])

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
        if (!localComment || 
            localComment.id != comment.id || 
            comment.blocked != localComment.blocked ||
            comment.name != localComment.name ||
            comment.comment != localComment.comment || 
            comment.flagged != localComment.flagged
        ) {
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
            updateSticker(updatedComment);
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

    const [nameListOpen, setNameListOpen] = useState(false);
    const [nameListId, setNameListId] = useState(0);
    const [nameListOffset, setNameListOffset] = useState([0, 0])

    function closeNameList() {
        setNameListOpen(false);
    }

    function onUserBlocked(userData: SubUserData, blocked: boolean) {
        const adminToken = appContext.adminBackend?.adminToken;
        if (!adminToken) { return; }
        if (!appContext.adminBackend) { return; }

        appContext.adminBackend.adminToken = adminToken;
        appContext.adminBackend?.blockUser(userData.visitorid, blocked);
    }

    function onIPBlocked(address: string, blocked: boolean) {
        const adminToken = appContext.adminBackend?.adminToken;
        if (!adminToken) { return; }
        if (!appContext.adminBackend) { return; }

        appContext.adminBackend.adminToken = adminToken;
        appContext.adminBackend.blockIP(address, blocked);
    }

    function renderNameList(): JSX.Element {
        if (!appContext.adminEnabled || !appContext.adminBackend) { return (<></>)}
        if (!nameListOpen || !nameListId) { return (<></>) }

        const data = appContext.adminBackend.userData.find((data) => {
            return data.visitorid == nameListId;
        })

        if (!data) { return (<></>) }

        return (
            <UserDetails 
                nameListOffset={nameListOffset} 
                userData={data} 
                onClosed={closeNameList} 
                onBlocked={(data, blocked) => {onUserBlocked(data, blocked)}}
                onIPBlocked={((address, blocked) => {onIPBlocked(address, blocked)})}
            />
        )
    }

    function onNameClicked(id: number, event: React.MouseEvent) {
        if (nameListOpen) { return; }
        setNameListOpen(true);

        setNameListId(id);
        setNameListOffset([event.pageX, event.pageY]);
    }


    function renderFlaggedContent(isFlagged:Boolean):JSX.Element {
        if (!isFlagged) { return (<></>)}
        const image = Stickers[stickerIndex ?? 0];
        return (<img src={image} className="flaggedImage"/>)
    }

    function openLink(comment: CommentEntry) {
        if (comment.thumbLink != null) {
            window.open(comment.thumbLink);
        }
    }

    function renderVideoPreview(comment: CommentEntry): JSX.Element {
        if (comment.flagged || (comment.thumbTitle == null && comment.thumbImg == null)) { return (<></>)}
        return (<div className="preview" onClick={() => {openLink(comment)}}>
            <div>{comment.thumbImg ? (<img src={comment.thumbImg} />) : (<></>)}</div>
            <div style={{marginLeft: 10}}>{comment.thumbTitle}</div>
        </div>)
    }

    function renderMessageParts(message:string):JSX.Element[] {
        const ret:JSX.Element[] = [];
        const parts = findHyperlinks(message);

        for (let i = 0; i < parts.length; i++) {
            if (parts[i].match == null) {
                const parsed = parts[i].str.split("\n");
                for (let j = 0; j < parsed.length; j++) {
                    if (j > 0) {
                        ret.push((<br/>));
                    }
                    ret.push((<>{parsed[j]}</>));
                }
            } else {
                ret.push((
                    <a target="_blank" rel="noopener noreferrer" href={parts[i].str}>
                        {parts[i].match}
                    </a>
                ));
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
            {renderVideoPreview(localComment)}
        </>)
    }

    const name = (localComment.name) ? localComment.name : "anon";
    const visitor = appContext.visitorBackend?.entries.get(localComment.visitorid)
    const alias = (visitor && visitor.alias) ? visitor.alias : undefined;
    
    let nameClass = "name"
    if (alias) { nameClass += " censored"; }


    let commentClass = "comment";
    //if (localComment.blocked) {
    //    commentClass += " blocked";
    //}

    return (<>
        <div className={commentClass} key={"comment-" + localComment.id} id={localComment.id.toString()} style={{ marginLeft: indent + "px" }}>
            <div className="commentLeft" style={(localComment.flagged) ? {minHeight: 160} : {}}>
                <div className='header' onClick={(ev) => {onNameClicked(localComment.visitorid, ev)}}>
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
        {renderNameList()}
    </>)
}

export default Comment;