import React, { JSX, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppContext, AppUpdateContext } from "./App";
import { IPAddress, UserData } from "./AdminTools";

interface AdminMainProps {
}

export const AdminMain:React.FC<AdminMainProps> = ({
}:AdminMainProps) => {
    const appContext = useContext(AppContext);
    const appUpdateContext = useContext(AppUpdateContext);

    const [nameListOpen, setNameListOpen] = useState(false);
    const [nameListId, setNameListId] = useState(0);
    const [nameListOffset, setNameListOffset] = useState([0, 0])
    const [userData, setUserData] = useState<UserData[]>([]);

    useEffect(() => {
        setUserData(appContext.adminBackend?.userData ?? []);
    }, [appUpdateContext.triggerAdminUpdate])
;
    const dt = new Date()
    dt.setHours(0, 0, 0, 0);
    const today = dt.getTime() - (1000 * 60 * 60 * 24);
    /*
        function triggerAliasUpdate(id: number, alias: string) {
            const adminToken = appContext.adminBackend?.adminToken;
            if (!adminToken) { return; }
    
            appContext.visitorBackend?.updateAlias({id: id, alias: alias}, adminToken);
        }
    */

    function onUserBlocked(userData: UserData, blocked: boolean) {
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
            <UserDetails 
                nameListOffset={nameListOffset} 
                userData={data} 
                onClosed={closeNameList} 
                onBlocked={(data, blocked) => {onUserBlocked(data, blocked)}}
                onIPBlocked={(address, blocked) => {onIPBlocked(address, blocked)}}
            />
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
                    //const alias = aliasData.get(value.visitorid)
                    return (
                        <AdminLine userData={value} onNameClicked={onNameClicked} />
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
    //aliasData: VisitorEntry | undefined,
    //triggerAliasUpdate: (id: number, alias: string) => void
    onNameClicked: (id: number, event: React.MouseEvent) => void
}

const AdminLine: React.FC<AdminLineProps> = ({
    userData,
    //aliasData,
    //triggerAliasUpdate,
    onNameClicked,
}: AdminLineProps) => {
    /*
        const [aliasLocal, setAliasLocal] = useState(aliasData?.alias ?? "");
    
        
        function onAliasUpdatedLocal(evt: React.ChangeEvent<HTMLInputElement>, _: number) {
            const value = evt.target.value;
            setAliasLocal(value);
        }
    */
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


interface UserDetailsProps {
    userData: UserData,
    nameListOffset: number[],
    onClosed: () => void,
    onBlocked: (userData: UserData, blocked: boolean) => void,
    onIPBlocked: (address: string, blocked: boolean) => void,
}

export const UserDetails: React.FC<UserDetailsProps> = ({
    userData,
    nameListOffset,
    onClosed,
    onBlocked,
    onIPBlocked,
}: UserDetailsProps) => {
    const nameListOpened = useRef(0);
    const selfClicked = useRef(0);

    const clickCallback = useCallback(() => {
        const now = new Date().getTime();
        const diff = now - nameListOpened.current;
        const selfDiff = now - selfClicked.current;
        if (diff <= 100 || selfDiff < 100) { return; }
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

    function selfClickedEvt() {
        selfClicked.current = new Date().getTime();
    }

    return (
        <div className="nameListContainer" onClick={() => { selfClickedEvt() }}>
            <div className="nameList"
                style={{ left: nameListOffset[0], top: nameListOffset[1] }}
            >
                <div className="userBlockDiv">
                    <div>block</div>
                    <input type="checkbox" checked={userData.blocked} onChange={() => {onBlocked(userData, !userData.blocked)}}/>
                </div>
                <div>
                    {userData.names.map((name) => {
                        return (<div key={Math.random()}>{name}</div>);
                    })}
                </div>
                <div className="line"></div>
                <div>
                    {userData.ipAddresses.map((address) => {
                        return (<IPEntry ipData={address} onBlocked={(data) => {onIPBlocked(data, !address.blocked)}} />)
                    })}
                </div>
            </div>
        </div>)
}

interface IPEntryProps {
    ipData: IPAddress,
    onBlocked: (address:string) => void
};

export const IPEntry: React.FC<IPEntryProps> = ({
    ipData,
    onBlocked
}:IPEntryProps) => {
    let stripped = ipData.address;
    if (stripped.startsWith("::ffff:")) {
        stripped = stripped.substring(7);
    }
    return (<div key={Math.random()} className="ipBlockDiv">
        <div>{stripped}</div>
        <input type="checkbox" checked={ipData.blocked} onClick={() => {onBlocked(ipData.address)}} />
    </div>)
}
