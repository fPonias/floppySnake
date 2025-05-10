import React, { JSX, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "./App";
import { UserData } from "./AdminTools";
import { VisitorEntry } from "./VisitorEntry";
import useMount from "./useMount";

interface AdminProps {
    userData: UserData[],
    aliasData: Map<number, VisitorEntry>
}

export const AdminPanel:React.FC<AdminProps> = ({
    userData,
    aliasData,
}:AdminProps) => {
    const appContext = useContext(AppContext);

    const [nameListOpen, setNameListOpen] = useState(false);
    const [nameListId, setNameListId] = useState(0);
    const [nameListOffset, setNameListOffset] = useState([0, 0])
    
    const dt = new Date()
    dt.setHours(0, 0, 0, 0);
    const today = dt.getTime() - (1000 * 60 * 60 * 24);

    function triggerAliasUpdate(id: number, alias: string) {
        const adminToken = appContext.adminBackend?.adminToken;
        if (!adminToken) { return; }

        appContext.visitorBackend?.updateAlias({id: id, alias: alias}, adminToken);
    }

    function closeNameList() { 
        setNameListOpen(false);
    }

    function renderNameList(): JSX.Element {
        if (!nameListOpen || !nameListId) { return (<></>) }

        const data = userData.find((data) => {
            return data.visitorid == nameListId;
        })

        if (!data) { return (<></>) }

        return (
            <NameList nameListOffset={nameListOffset} userData={data} onClosed={closeNameList} />
        )
    }

    function onNameClicked(id: number, event: React.MouseEvent) {
        if (nameListOpen) { return; }
        setNameListOpen(true);

        setNameListId(id);
        setNameListOffset([event.pageX, event.pageY]);
    }

    function setAllowPosts(value: boolean) {
        if (!appContext.commentBackend) { return; }
        if (!appContext.adminBackend?.adminToken) { return; }
        appContext.commentBackend.adminToken = appContext.adminBackend.adminToken;
        appContext.commentBackend.setAllowPosts(value);
    }

    function renderAllowPosts() {
        return (
            <div className="allowPostsDiv">
                <input type="checkbox" checked={appContext.allowPosts} onChange={() => { setAllowPosts(!appContext.allowPosts) }} />
                <div>Allow posts</div>
            </div>
        )
    }

    if (!appContext.adminEnabled || !appContext.adminBackend) { return (<></>) }


    const filtered = userData.filter((value) => {
        if (value.isActive) { return true; }
        if (value.lastPost >= today) { return true; }

        return false;
    })
    return (<div className="admin">
        <table className="adminPanel">
            <thead><tr><th>id</th><th>name</th><th>posts</th><th>flagged</th><th>active</th></tr></thead>
            <tbody>
            {filtered.map((value, _) => {
                const alias = aliasData.get(value.visitorid)
                return (
                    <AdminLine userData={value} aliasData={alias} triggerAliasUpdate={triggerAliasUpdate} onNameClicked={onNameClicked}/>
                );
            })}
            </tbody>
        </table>
        {renderNameList()}
        {renderAllowPosts()}
    </div>)
};

interface AdminLineProps {
    userData: UserData,
    aliasData: VisitorEntry | undefined,
    triggerAliasUpdate: (id: number, alias: string) => void
    onNameClicked: (id: number, event: React.MouseEvent) => void
}

const AdminLine: React.FC<AdminLineProps> = ({
    userData,
    aliasData,
    triggerAliasUpdate,
    onNameClicked,
}: AdminLineProps) => {

    const [aliasLocal, setAliasLocal] = useState(aliasData?.alias ?? "");

    
    function onAliasUpdatedLocal(evt: React.ChangeEvent<HTMLInputElement>, _: number) {
        const value = evt.target.value;
        setAliasLocal(value);
    }

    return (<tr>
        <td>{userData.visitorid}</td>
        <td
            onClick={(event) => { onNameClicked(userData.visitorid, event) }}
        >{userData.names[0]}</td>
        <td>{userData.commentCount}</td>
        <td>{userData.flaggedCount ?? 0}</td>
        <td>{userData.isActive ? "X" : ""}</td>
    </tr>)
}

interface NameListProps {
    userData: UserData,
    nameListOffset: number[]
    onClosed: () => void
}

export const NameList: React.FC<NameListProps> = ({
    userData,
    nameListOffset,
    onClosed
}: NameListProps) => {
    const nameListOpened = useRef(0);

    const clickCallback = useCallback(() => {
        const now = new Date().getTime();
        if (now - nameListOpened.current <= 100) { return; }
        onClosed()
    }, [nameListOpened]);
    const callbackRef = useRef(clickCallback);
    useEffect(() => { callbackRef.current = clickCallback }, [callbackRef, clickCallback]);

    useEffect(() => {
        nameListOpened.current = new Date().getTime();
        document.body.addEventListener('click', callbackRef.current);

        return () => {
            document.body.removeEventListener('click', callbackRef.current)
        }
    });

    return (
        <div className="nameList"
            style={{ left: nameListOffset[0], top: nameListOffset[1] }}
        >
            {userData.names.map((name) => {
                return (<div>{name}</div>);
            })}
        </div>
    )
}
