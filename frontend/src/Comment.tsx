import { useContext, useEffect, useState } from "react";
import CommentEntry from "./CommentEntry";
import { FormComponent } from "./Form";
import { AppContext } from "./App";
import EventEmitter from "reactjs-eventemitter";

interface CommentProps {
    comment: CommentEntry,
    onReply?: (id: number) => void,
    onDelete?: (id: number) => void,
    hasActiveReply?: boolean,
    isExpanded?: boolean,
    onExpanded?: (id: number, expanded: boolean) => void,
    indent?: number,
}

const Comment:React.FC<CommentProps> = ({
    comment,
    onReply = () => {},
    onDelete = () => {},
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

    function renderReply() {
        if (hasActiveReply) {
            return (
                <FormComponent 
                    active={hasActiveReply} 
                    replyTo={localComment}
                />
            )
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
        }
    }, [isExpanded, localComment, isOverFlowing, messageRef])

    function renderMessage() {
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

        const parsed = localComment.comment.split("\n");

        return (<>
            <div className={messageClass} ref={(ref) => {setMessageRef(ref)}}>{parsed.map((str) => {return (<>{str}<br/></>)})}</div>
            {link}
        </>)
    }

    const time = dateToAgo(localComment.posted);
    const name = (localComment.name) ? localComment.name : "anonymous coward";
    return (<>
        <div className='comment' key={"comment-" + localComment.id} id={localComment.id.toString()} style={{ marginLeft: indent + "px" }}>
            <div className='header'><span className='name'>{name}</span><span className='time'>{time}</span></div>
            {renderMessage()}
            <div className="reply" onClick={() => { onReply(localComment.id) }}>
                <a>Reply</a>
            </div>
            {!appContext.adminEnabled ? (<></>) : (
                <div className="delete" onClick={() => { onDelete(localComment.id) }}>
                    <a>Delete</a>
                </div>
            )}
            {renderReply()}
        </div>
    </>)
}

export default Comment;