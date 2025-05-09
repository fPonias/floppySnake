import { createContext, JSX, useCallback, useContext, useRef, useState } from 'react'
import './App.css'
import useMount from './useMount';
import { FormComponent } from './Form';
import CommentEntry, { CommentEntries } from './CommentEntry';
import useWebSocket from 'react-use-websocket';
import env from '../../env'
import { WebSocketHook } from 'react-use-websocket/dist/lib/types';
import { useCookies } from "react-cookie";
import Comment from './Comment';
// @ts-ignore
import EventEmitter from "reactjs-eventemitter";
import { AdminTools, UserData } from './AdminTools';
import { AdminPanel } from './Admin';
import VisitorEntries from './VisitorEntry';

interface ActiveReplyData {
    name: string,
    comment: string,
    id: number
}

export interface AppContextProps {
    commentBackend: CommentEntries | null,
    adminBackend: AdminTools | null,
    visitorBackend: VisitorEntries | null,
    apiToken: string | null,
    adminEnabled: boolean,
    expandedComments: Set<number>,
    activeReply: ActiveReplyData | null,
    onPosted: () => void,
};

export const AppContext = createContext<AppContextProps>({
    commentBackend: null,
    adminBackend: null,
    visitorBackend: null,
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

    const [cookies, setCookie, removeCookie] = useCookies(["token", "name", "apiToken"]);
    const [triggerUpdate, setTriggerUpdate] = useState(0);
    const [triggerAdminUpdate, setTriggerAdminUpdate] = useState(0);
    
    appContext.onPosted = function() {
        appContext.activeReply = null;
        setTriggerUpdate(triggerUpdate + 1);
    }

    ws.current = useWebSocket(env.socketUrl, {
        onOpen: () => {
            console.log('opened');

            if (ws.current) {
                ws.current.sendMessage(JSON.stringify({action: "apiTokenVerify", token: cookies.apiToken}));
            }
        },
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
                setCookie("apiToken", data.token);
                appContext.apiToken = data.token;

                if (cookies.token) {
                    const arg = JSON.stringify({ action: "adminTokenVerify", token: cookies.token });
                    ws.current?.sendMessage(arg);
                }
            } else if (data.action == "update") {
                const id = data.postid;
                const commentBack = appContext.commentBackend;

                if (!commentBack) { return;}

                doUpdateOn(id);
            } else if (data.action == "login") {
                appContext.adminBackend?.runUpdate();
            } else if (data.action == "logout") {
                appContext.adminBackend?.runUpdate();
            } else if (data.action == "isAdmin") {
                if (!data.result) {
                    removeCookie("token");
                }

                appContext.adminEnabled = data.result;
                if (appContext.adminBackend) {
                    appContext.adminBackend.adminToken = cookies.token;
                    appContext.adminBackend.runUpdate();
                }
            } else if (data.action == "adminToken") {
                appContext.adminEnabled = (data.result) ? true : false;
                setCookie("token", data.result);
                if (appContext.adminBackend) {
                    appContext.adminBackend.adminToken = data.result;
                    appContext.adminBackend.runUpdate();
                }
            } else if (data.action == "alias") {
                if (appContext.visitorBackend) {
                    appContext.visitorBackend.fetchNewest();
                }
            }
        },
    });

    function getSiteID():string {
        const site = window.location.host;
        const path = window.location.pathname;

        return site + "/" + path;
    }

    const visitorDataListener = useCallback(() => {
        setTriggerUpdate(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    }, [triggerUpdate]);

    const userDataListener = useCallback(() => {
        setTriggerAdminUpdate(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    }, [triggerAdminUpdate]);

    useMount(() => {
        setLoading(true);
        const siteid = getSiteID();
        if (appContext.commentBackend == null || appContext.commentBackend.url != siteid) {
            appContext.commentBackend = new CommentEntries(siteid);
        }

        if (appContext.adminBackend == null) {
            appContext.adminBackend = new AdminTools();
            appContext.adminBackend.addUserDataListener(userDataListener);
        }

        if (appContext.visitorBackend == null) {
            appContext.visitorBackend = new VisitorEntries();
            appContext.visitorBackend.addVisitorDataListener(visitorDataListener);
        }

        let lastTime = new Date().getTime();
        setInterval(() => {
            const time = new Date().getTime();
            const diff = time - lastTime;
            if (diff >= 1000) {
                EventEmitter.dispatch("clockTick", { });
                lastTime += 1000;
            }
        }, 250);

        async function delayed() {
            if (!appContext.commentBackend) {return}

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
            removeCookie("token");
        }
    }

    async function firstLoad() {
        await appContext.commentBackend?.getPost();
        await appContext.commentBackend?.getRecent();
        await appContext.commentBackend?.sortTree();

        await appContext.visitorBackend?.fetchNewest();

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
                key={comment.id} 
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
        if (!ws.current) { return; }

        const password = prompt('Password:')
        const arg = JSON.stringify({ action: "adminTokenRequest", password: password });
        await ws.current.sendMessage(arg);
    }

    if (loading) {
        return (<div>Loading ...</div>)
    }

    const aliasData = appContext.visitorBackend?.entries ?? new Map()
    const userData = appContext.adminBackend?.userData ?? []

    return (<div className='outer'>
        <div style={{marginBottom: "20px"}}>
            <AdminPanel userData={userData} aliasData={aliasData} key={triggerAdminUpdate} />
        </div>
        <FormComponent onAdminEnabled={(_) => onAdminEnabled()}/>
        <div className='comments'>
            {renderComments(0, comments)}
            {renderLoadMore()}
        </div>
    </div>)
}

export default App
