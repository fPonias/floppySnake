import { createContext, JSX, useCallback, useContext, useEffect, useRef, useState } from 'react'
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
import { AdminTools } from './AdminTools';
import { AdminPanel } from './Admin';
import VisitorEntries from './VisitorEntry';
import { LocalStorageKeys, useLocalStorage } from './localStorageWrapper';

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
    allowPosts: boolean,
    expandedComments: Set<number>,
    activeReply: ActiveReplyData | null,
    onPosted: () => void,
    stickerIndex: Map<number, number>,
    g: boolean
    userStatus: number
};

export const AppContext = createContext<AppContextProps>({
    commentBackend: null,
    adminBackend: null,
    visitorBackend: null,
    apiToken: null,
    adminEnabled: false,
    allowPosts: false,
    expandedComments: new Set(),
    activeReply: null,
    onPosted: () => {},
    stickerIndex: new Map(),
    g: false,
    userStatus: -1,
});

export interface AppUpdateContextProps {
    triggerAdminUpdate: number,
    triggerUpdate: number,
}

export const AppUpdateContext = createContext<AppUpdateContextProps>({
    triggerAdminUpdate: 0,
    triggerUpdate: 0
})

function App() {
    const [comments, setComments] = useState<CommentEntry[]>([]);
    
    const [loading, setLoading] = useState(false);
    const appContext = useContext(AppContext);
    const updateContext = useContext(AppUpdateContext);

    const ws = useRef<WebSocketHook | undefined>(undefined);

    const [cookies] = useCookies(["token", "name", "apiToken"]);
    const {getter: name, setter: setName} = useLocalStorage(LocalStorageKeys.name);
    const {getter: token, setter: setToken} = useLocalStorage(LocalStorageKeys.token);
    const {getter: apiToken, setter: setApiToken} = useLocalStorage(LocalStorageKeys.apiToken);

    useEffect(() => {
        const lsToken = localStorage.getItem("token");
        if (lsToken) { return; }
        if (cookies.token == undefined) { return; }

        setName(cookies.name);
        setToken(cookies.token);
        setApiToken(cookies.apiToken);
    }, [cookies]);

    const setTriggerUpdate = useCallback(() => {
        updateContext.triggerUpdate = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        setForceUpdate(updateContext.triggerUpdate);
    }, [updateContext.triggerUpdate]);

    const setTriggerAdminUpdate = useCallback(() => {
        updateContext.triggerAdminUpdate = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        setForceUpdate(updateContext.triggerAdminUpdate);
    }, [updateContext.triggerAdminUpdate]);

    const [_, setForceUpdate] = useState(updateContext.triggerAdminUpdate)

    appContext.onPosted = function() {
        appContext.activeReply = null;
        setTriggerUpdate();
    }

    const [socketUrl, setSocketUrl] = useState<string | null>(null);
    ws.current = useWebSocket(socketUrl, {
        onOpen: () => {
            console.log('opened');

            if (ws.current) {
                ws.current.sendMessage(JSON.stringify({action: "apiTokenVerify", token: apiToken}));
            }
        },
        shouldReconnect: (_) => true,
        onClose: () => {
            appContext.commentBackend?.reset();
            setComments(appContext.commentBackend?.tree ?? []);
            setLoading(true);
        },
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
                    doUpdate().then(() => {
                        if (appContext.adminEnabled) {
                            appContext.adminBackend?.runUpdate();
                        }
                    })
                }
            } else if (data.action == "token") {
                setApiToken(data.token);
                appContext.apiToken = data.token;

                const commentBack = appContext.commentBackend;
                if (!commentBack) { return; }
                commentBack.apiToken = data.token;

                appContext.g = data.g;
                appContext.userStatus = data.status;
                firstLoad();

                if (token) {
                    const arg = JSON.stringify({ action: "adminTokenVerify", token: token });
                    ws.current?.sendMessage(arg);
                }
            } else if (data.action == "update") {
                const id = data.postid;
                const commentBack = appContext.commentBackend;

                if (!commentBack) { return;}

                doUpdateOn(id).then(() => {appContext.adminBackend?.runUpdate() });
            } else if (data.action == "login") {
                appContext.adminBackend?.runUpdate();
            } else if (data.action == "logout") {
                appContext.adminBackend?.runUpdate();
            } else if (data.action == "isAdmin") {
                if (!data.result) {
                    setToken(null);
                }

                appContext.adminEnabled = data.result;
                if (appContext.adminBackend) {
                    appContext.adminBackend.adminToken = token;
                    appContext.adminBackend.runUpdate().then(() => {
                        appContext.adminBackend?.runUpdateFilters().then(
                            () => { setTriggerAdminUpdate(); }
                        )
                    });
                }
            } else if (data.action == "adminToken") {
                appContext.adminEnabled = (data.result) ? true : false;
                setToken(data.result);
                if (appContext.adminBackend) {
                    appContext.adminBackend.adminToken = data.result;
                    appContext.adminBackend.runUpdate().then(() => {
                        appContext.adminBackend?.runUpdateFilters().then(
                            () => { setTriggerAdminUpdate(); }
                        )
                    });
                }
            } else if (data.action == "alias") {
                if (appContext.visitorBackend) {
                    appContext.visitorBackend.fetchNewest().then(
                        () => { setTriggerAdminUpdate(); }
                    );
                }
            } else if (data.action == "allowPosts") {
                appContext.allowPosts = data.allowPosts;

                forceUpdate(0).then(() => {
                    setTriggerUpdate();
                    setTriggerAdminUpdate();
                });
            } else if (data.action == "filtersUpdated") {
                if (appContext.adminBackend && appContext.adminEnabled) {
                    appContext.adminBackend.runUpdateFilters().then(
                        () => { setTriggerAdminUpdate(); }
                    )
                }
            } else if (data.action == "block") {
                if (appContext.adminBackend && appContext.adminEnabled) {
                    appContext.adminBackend.runUpdate().then(() => {
                        appContext.adminBackend?.runUpdateFilters().then(
                            () => { setTriggerAdminUpdate(); }
                        )
                    })
                }

                const date = data.updated;
                const commentBack = appContext.commentBackend;

                if (!commentBack) { return; }
                forceUpdate(date).then(() => {});
            } else if (data.action == "refresh") {
                appContext.commentBackend?.reset();
                firstLoad();
            } else if (data.action == "gibberish") {
                appContext.commentBackend?.updateGibberish();
            }
        },
    });

    function getSiteID():string {
        const site = window.location.host;
        const path = window.location.pathname;

        return site + "/" + path;
    }

    const visitorDataListener = () => {
        setTriggerUpdate();
    }

    const userDataListener = () => {
        setTriggerAdminUpdate();
    }

    useEffect(() => {
        document.addEventListener("visibilitychange", visChngF);
        visChngF();
        // Specify how to clean up after this effect:
        return () => {
            window.removeEventListener("visibilitychange", visChngF);
        };

    }, []);

    function visChngF() {
        if (document.hidden) {
            console.log("hidden means user is gone");
            setSocketUrl(null);
        } else {
            console.log("visible means user is back");
            setSocketUrl(env.socketUrl);
        }
    }

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
    });

    function replyClicked(id: number) {
        if (id == appContext.activeReply?.id) {
            appContext.activeReply = null;
        } else {
            appContext.activeReply = {
                id: id,
                name: name ?? "",
                comment: ""
            }
        }

        setTriggerUpdate();
    }

    async function deleteClicked(id:number) {
        if (!appContext.adminEnabled) { return; }
        if (!appContext.commentBackend || !appContext.adminBackend) { return; }

        appContext.commentBackend.adminToken = appContext.adminBackend.adminToken
        const result = await appContext.commentBackend?.deletePost(id);
        if (result == 401) {
            appContext.adminEnabled = false;
            setToken(null);
        }
    }

    async function firstLoad() {
        const allow = await appContext.commentBackend?.getAllowPosts();
        appContext.allowPosts = allow ?? false;

        await appContext.commentBackend?.getPost();
        await appContext.commentBackend?.getRecent();
        await appContext.commentBackend?.sortTree();
        await appContext.commentBackend?.updateGibberish();

        await appContext.visitorBackend?.fetchNewest();

        setComments(appContext.commentBackend?.tree ?? []);
        setLoading(false);
    }

    async function doUpdate() {
        await appContext.commentBackend?.getNewest();
        await appContext.commentBackend?.sortTree();
        setComments(appContext.commentBackend?.tree ?? []);
    }

    async function forceUpdate(from: number) {
        await appContext.commentBackend?.getFrom(from);
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

    const [commentCount, setCommentCount] = useState(0);
    useEffect(() => {
        const count = appContext.commentBackend?.count ?? 0;
        setCommentCount(count);
    }, [comments])

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

        setTriggerUpdate();
    }

    function onCommentFlagged(id: number) {
        if (!appContext.adminEnabled) { return; }
        if (!appContext.commentBackend || !appContext.adminBackend) { return; }
        appContext.commentBackend.adminToken = appContext.adminBackend.adminToken
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

    //const aliasData = appContext.visitorBackend?.entries ?? new Map()

    function renderAdminPanel() {
        if (!appContext.adminEnabled) { return (<></>); }

        return (
            <div style={{ marginBottom: "20px" }}>
                <AdminPanel/>
            </div>
        )
    }

    function renderCommentCount() {
        const rand = Math.round(Math.random() * 6 + 1);
        const count = (commentCount < 20) ? commentCount : commentCount * rand;
        return (<div className="titleDiv">
            <div>
                <span className="title">Leave a comment</span> 
            </div>
            <div className='subtitle'>A Snek free day is a good day.</div>
            <div className='count'>
                <span className='commentCount'>{count}</span>
                <span>Comments so far</span>
            </div>
        </div>)
    }

    function renderMain() {        
        if (appContext.userStatus == -1) {
            return (<></>)
        } else if (appContext.userStatus == 0) {
            return (<>
                <div className="titleDiv">
                    <div>
                        <span className="title">Halt!  Who goes there?</span> 
                    </div>
                    <div className='subtitle'>Identify yourself stranger.</div>
                </div>
                <FormComponent onAdminEnabled={(_) => onAdminEnabled()}/>
            </>)
        } else if (appContext.userStatus == 1) {
            return (<>
                <div className="titleDiv">
                    <div>
                        <span className="title">Thank you</span>
                    </div>
                    <div className='subtitle'>Your request for admittance has been submitted.</div>
                </div>
            </>)
        } else if (appContext.userStatus == 3) {
            return (<>
                {renderCommentCount()}
                {renderSnakeQuote()}
                <FormComponent onAdminEnabled={(_) => onAdminEnabled()}/>
                <div className='comments'>
                    {renderComments(0, comments)}
                    {renderLoadMore()}
                </div>
            </> )
        } else {
            return (<>
                <div className="titleDiv">
                    <div>
                        <span className="title">You have been banned</span>
                    </div>
                    <div className='subtitle'>If you feel there's been a mistake, whine about it on Snek antiSocial.  Be sure to talk extra loud so Azzreel can hear you.</div>
                </div>
                <div className='comments'>
                    {renderComments(0, comments)}
                    {renderLoadMore()}
                </div>
            </>)
        }
    }

    function renderSnakeQuote() {
        if (!appContext.commentBackend?.gibberish) {
            return (<></>)
        }

        const gibberish = appContext.commentBackend?.gibberish;
        return (
            <div className="snakeQuote">
                <div>Quote of the hour</div>
                <div style={{fontStyle: 'italic'}}>{gibberish.message}</div>
            </div>
        )
    }

    return (<div className='outer'>
        {renderAdminPanel()}
        {renderMain()}
    </div>)
}

export default App
