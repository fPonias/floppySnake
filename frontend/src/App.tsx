import { createContext, JSX, useContext, useRef, useState } from 'react'
import './App.css'
import useMount from './useMount';
import { FormComponent } from './Form';
import CommentEntry, { CommentEntries } from './CommentEntry';
import useWebSocket from 'react-use-websocket';
import env from '../../env'
import { WebSocketHook } from 'react-use-websocket/dist/lib/types';
import { useCookies } from "react-cookie";
import Comment from './Comment';

interface ActiveReplyData {
    name: string,
    comment: string,
    id: number
}

export interface AppContextProps {
    commentBackend: CommentEntries | null,
    apiToken: string | null,
    adminEnabled: boolean,
    expandedComments: Set<number>,
    activeReply: ActiveReplyData | null,
    onPosted: () => void,
};

export const AppContext = createContext<AppContextProps>({
    commentBackend: null, 
    apiToken: null,
    adminEnabled: false,
    expandedComments: new Set(),
    activeReply: null,
    onPosted: () => {}
});

function App() {
    const [comments, setComments] = useState<CommentEntry[]>([]);
    
    const [loading, setLoading] = useState(false);
    const appContext = useContext(AppContext);

    const ws = useRef<WebSocketHook | undefined>(undefined);

    const [cookies, setCookie, unsetCookie] = useCookies(["token", "name"]);
    const [triggerUpdate, setTriggerUpdate] = useState(0);
    
    appContext.onPosted = function() {
        appContext.activeReply = null;
        setTriggerUpdate(triggerUpdate + 1);
    }

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
        if (id == appContext.activeReply?.id) {
            appContext.activeReply = null;
        } else {
            appContext.activeReply = {
                id: id,
                name: cookies.name ?? "",
                comment: ""
            }
        }

        setTriggerUpdate(triggerUpdate + 1);
    }

    async function deleteClicked(id:number) {
        if (!appContext.adminEnabled) { return; }

        const result = await appContext.commentBackend?.deletePost(id);
        if (result == 401) {
            appContext.adminEnabled = false;
            unsetCookie("token");
        }
    }

    async function firstLoad() {
        await appContext.commentBackend?.getPost();
        await appContext.commentBackend?.getRecent();
        await appContext.commentBackend?.sortTree();
        setComments(appContext.commentBackend?.tree ?? []);
    }

    async function doUpdate() {
        await appContext.commentBackend?.getNewest();
        await appContext.commentBackend?.sortTree();
        setComments(appContext.commentBackend?.tree ?? []);
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

    function onCommentExpanded(id: number, isExpanded: boolean) {
        if (isExpanded) {
            appContext.expandedComments.add(id);
        } else {
            appContext.expandedComments.delete(id);
        }

        setTriggerUpdate(triggerUpdate + 1);
    }

    function onCommentFlagged(id: number) {
        appContext.commentBackend?.flagPost(id);
    }

    function renderComments(depth: number, commentsList: CommentEntry[]):JSX.Element[] {
        if(commentsList.length == 0) {return ([])}

        const indent = depth * 20;
        const ret:JSX.Element[] = []
        for (let comment of commentsList) {
            const isExpanded = appContext.expandedComments.has(comment.id)
            const hasActiveReply = appContext.activeReply?.id == comment.id

            const elem = (<Comment
                comment={comment}
                onReply={(id) => {replyClicked(id)}}
                onDelete={(id) => {deleteClicked(id)}}
                onExpanded={(id, expanded) =>  onCommentExpanded(id, expanded)}
                onFlag={(id) => onCommentFlagged(id)}
                indent={indent}
                isExpanded={isExpanded}
                hasActiveReply={hasActiveReply}
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
