import React, { createContext, JSX, useContext, useEffect, useReducer, useRef, useState } from 'react'
import './App.css'
import useMount from './useMount';
import { FormComponent } from './Form';
import CommentEntry, { CommentEntries } from './CommentEntry';
import useWebSocket from 'react-use-websocket';
import env from '../../env'
import { WebSocketHook } from 'react-use-websocket/dist/lib/types';
import { useCookies } from "react-cookie";
import { CookieValues } from "./defs";
import Comment from './Comment';


export interface AppReducerProps {
}

export enum AppReducerAction {
    UPDATED
}
export interface AppReducerEvent {
    action: AppReducerAction,
    data: any
}

export interface AppReducerState {
    updatedComments: Set<number>
}

export interface AppContextProps {
    commentBackend: CommentEntries | null,
    apiToken: string | null,
    adminEnabled: boolean,
    appReducerState: AppReducerState
};

export const AppContext = createContext<AppContextProps>({
    commentBackend: null, 
    apiToken: null,
    adminEnabled: false,
    appReducerState: {updatedComments: new Set()}
});


function App() {
    const [comments, setComments] = useState<CommentEntry[]>([]);
    const [activeReply, setActiveReply] = useState<number | undefined>(undefined);

    const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
    const [updateExpandedMessage, setUpdateExpandedMessage] = useState<number>(-1);
    const [updateContractedMessage, setUpdateContractedMessage] = useState<number>(-1);
    
    const [loading, setLoading] = useState(false);
    const appContext = useContext(AppContext);

    const ws = useRef<WebSocketHook | undefined>(undefined);

    const [cookies, setCookie] = useCookies<"token", CookieValues>(["token"]);
    
    ws.current = useWebSocket(env.socketUrl, {
        onOpen: () => console.log('opened'),
        shouldReconnect: (_) => true,
        share: true,
        onMessage: (evt) => {
            console.log("received message " + JSON.stringify(evt.data));

            const data = JSON.parse(evt.data);

            if (!data.action) {
                return;
            }

            if (data.action == "new") {
                //const postid = data.postid;
                const date = data.updated;
                const commentBack = appContext.commentBackend;

                if (!commentBack) { return; }

                if (date > commentBack.newest) {
                    doUpdate();
                }
            } else if (data.action == "token") {
                appContext.apiToken = data.token;
            } else if (data.action == "update") {
                const id = data.postid;
                const commentBack = appContext.commentBackend;

                if (!commentBack) { return;}

                doUpdateOn(id);
            }
        },
    });

    function getSiteID():string {
        const site = window.location.host;
        const path = window.location.pathname;

        return site + "/" + path;
    }

    useMount(() => {
        setLoading(true);
        const siteid = getSiteID();
        if (appContext.commentBackend == null || appContext.commentBackend.url != siteid) {
            appContext.commentBackend = new CommentEntries(siteid);
        }

        async function delayed() {
            if (!appContext.commentBackend) {return}

            if (cookies.token) {
                const verified = await appContext.commentBackend.verifyAdmin(cookies.token);
                appContext.adminEnabled = verified;
            }

            await firstLoad()
            setLoading(false)
        }
        delayed();
    });

    function replyClicked(id: number) {
        if (id == activeReply) {
            setActiveReply(undefined);
        } else {
            setActiveReply(id);
        }
    }

    async function deleteClicked(id:number) {
        if (!appContext.adminEnabled) { return; }

        await appContext.commentBackend?.deletePost(id);
    }

    async function firstLoad() {
        await appContext.commentBackend?.getPost();
        await appContext.commentBackend?.getRecent();
        await appContext.commentBackend?.sortTree();
        setComments(appContext.commentBackend?.tree ?? []);
        setActiveReply(undefined);
    }

    async function doUpdate() {
        await appContext.commentBackend?.getNewest();
        await appContext.commentBackend?.sortTree();
        setComments(appContext.commentBackend?.tree ?? []);
        setActiveReply(undefined);
    }

    async function doUpdateOn(id: number) {
        await appContext.commentBackend?.updateComment(id);
    }

    async function loadMore() {
        await appContext.commentBackend?.getOlder()
        await appContext.commentBackend?.sortTree();
        setComments(appContext.commentBackend?.tree ?? []);
    }

    function renderLoadMore() {
        const count = appContext.commentBackend?.count ?? 0;
        const map = appContext.commentBackend?.map;
        const mapSz = map?.size ?? 0;
        if (count > mapSz) {
            return (
                <a onClick={() => {loadMore()}}>More ...</a> 
            )
        } else {
            return (<></>)
        }
    }

    useEffect(() => {
        const idInt = updateContractedMessage;
        if (idInt == -1) { return; }
        if (!expandedMessages.has(idInt)) { return; }
        expandedMessages.delete(idInt);

        setExpandedMessages(new Set(expandedMessages));
        setUpdateContractedMessage(-1);
    }, [updateContractedMessage, expandedMessages])

    useEffect(() => {
        const idInt = updateExpandedMessage;
        if (idInt == -1) { return; }
        if (expandedMessages.has(idInt)) { return; }
        expandedMessages.add(idInt);

        setExpandedMessages(new Set(expandedMessages));
        setUpdateExpandedMessage(-1);
    }, [updateExpandedMessage, expandedMessages]);

    function renderComments(depth: number, commentsList: CommentEntry[]):JSX.Element[] {
        if(commentsList.length == 0) {return ([])}

        const indent = depth * 20;
        const ret:JSX.Element[] = []
        for (let comment of commentsList) {
            const isExpanded = expandedMessages.has(comment.id);
            const hasActiveReply = activeReply == comment.id
            const elem = (<Comment
                comment={comment}
                onReply={(id) => {replyClicked(id)}}
                onDelete={(id) => {deleteClicked(id)}}
                hasActiveReply={hasActiveReply}
                isExpanded={isExpanded}
                onExpanded={(id) => {setUpdateExpandedMessage(id)}}
                indent={indent}
            />)
            ret.push(elem);
            const children = renderComments(depth + 1, comment.children);
            if (children.length > 0) {
                ret.push(... children);
            }
        };

        return ret
    }

    async function onAdminEnabled() {
        if (!appContext.commentBackend) { return; }

        const password = prompt('Password:')
        const token = await appContext.commentBackend.requestAdmin(password ?? "");
        
        appContext.adminEnabled = (token != null);
        setCookie("token", token);
    }

    if (loading) {
        return (<div>Loading ...</div>)
    }


    return (<div className='outer'>
        <FormComponent onAdminEnabled={(_) => onAdminEnabled()}/>
        <div className='comments'>
            {renderComments(0, comments)}
            {renderLoadMore()}
        </div>
    </div>)
}

export default App
