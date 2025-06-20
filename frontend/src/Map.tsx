import { useCallback, useContext, useEffect, useRef, useState } from "react";
import env from "../../env"
import { AppContext } from "./App"; 
import './Map.css'
import useMount from "./useMount";


export default function MapView() {
    const appContext = useContext(AppContext);

    const [loading, setLoading] = useState<boolean>(false);
    const [selected, setSelected] = useState<number>(0);
    const map = useRef<any>(null);
    const userIds = useRef<Map<Number, Set<Number>>>(new Map());
    const [update, setUpdate] = useState<number>(0);

    useMount(() => {
        (g => { var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window; b = b[c] || (b[c] = {}); var d = b.maps || (b.maps = {}), r = new Set, e = new URLSearchParams, u = () => h || (h = new Promise(async (f, n) => { await (a = m.createElement("script")); e.set("libraries", [...r] + ""); for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]); e.set("callback", c + ".maps." + q); a.src = `https://maps.${c}apis.com/maps/api/js?` + e; d[q] = f; a.onerror = () => h = n(Error(p + " could not load.")); a.nonce = m.querySelector("script[nonce]")?.nonce || ""; m.head.append(a) })); d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)) })({
            key: "AIzaSyAZCjFTnKzJ6-eVIzN0dWGxi9Jszz8aQHM",
            v: "weekly",
            // Use the 'v' parameter to indicate the version to use (weekly, beta, alpha, etc.).
            // Add other bootstrap parameters as needed, using camel case.
        });

        async function initMap() {
            const { Map } = await google.maps.importLibrary("maps");

            map.current = new Map(document.getElementById("map"), {
                center: { lat: 38.7946, lng: -106.5348 },
                zoom: 3,
                mapId: "MX_Connections"
            });
        }

        initMap();
    })

    async function fetchComments(id: number): Promise<any[]> {
        const ids = userIds.current.get(id);
        if (ids == undefined) { return [] }

        let idArr = "";
        for (let id of ids) {
            if (idArr.length != 0) {
                idArr += ",";
            }

            idArr += id;
        }

        let url = env.api + "/commentData";
        if (appContext.adminBackend?.adminToken != null) {
            url += "/" + appContext.adminBackend.adminToken;
        }

        const res = await fetch(url, {
            method: 'POST',
            credentials: "include",
            headers: {
                'Content-Type': 'application/json',
            },
            body: '[' + idArr + ']'
        });

        const json = await res.json();
        return json;
    }

    useEffect(() => {
        if (index.current.size > 0 || loading) { return; }
        setLoading(true);

        const delayed = async () => {
            const url = env.api + "/ipData.json";
            const res = await fetch(url);
            const json = await res.json();

            for (let item of json) {
                const origid = item.userData[0].visitorid;
                tags.current.push(origid)
                index.current.set(origid, item.userData);
                //commentIndex.current.set(origid, item.comments);

                const ids = new Set<Number>();
                userIds.current.set(origid, ids);
                for (let data of item.userData) {
                    ids.add(data.visitorid);
                }

                const comments = await fetchComments(origid);
                commentIndex.current.set(origid, comments);
            }

            setLoading(false);

            renderMarkers();
        }
        delayed();
    }, [appContext.adminBackend?.adminToken, loading]);

    useEffect(() => {
        renderMarkers();
    }, [selected]);

    const index = useRef<Map<Number, any[]>>(new Map());
    const commentIndex = useRef<Map<Number, any[]>>(new Map());
    const tags = useRef<number[]>([]);
    const selectedRef = useRef<number>(0);

    useEffect(() => {
        selectedRef.current = selected;

        if (infoWindow.current != null) {
            infoWindow.current.close();
        }
    }, [selected]);

    function updatePoints(data: any[]) {
        const tagSet = new Set<number>();
        tags.current = [];

        const sz = data.length;
        for (let i = 0; i < sz; i++) {
            const line = data[i];
            let list = index.current.get(line.origid);
            if (!list) {
                list = [];
                index.current.set(line.origid, list);
                tagSet.add(line.origid);
            }


            list.push(line);
        }

        for (let tag of tagSet) {
            tags.current.push(tag)
        }
    };

    function renderSelector() {
        return (
            <div style={{marginBottom: 20}}>
                <select onChange={(elem) => {setSelected(elem.currentTarget.selectedIndex)}}>
                    {tags.current.map((line, idx) => {return (
                        <option selected={selected == idx}>{line}</option>
                    )})}
                </select>
                <button style={{ marginLeft: 20 }} onClick={() => { 
                    setSelected(Math.max(0, selected - 1)) }
                }>prev</button>
                <button style={{marginLeft: 20}} onClick={() => {
                    setSelected(Math.min(tags.current.length - 1, selected + 1))}
                }>next</button>
            </div>
        )
    }

    const markers = useRef<any[]>([]);
    const infoWindow = useRef<any>(null);

    function openInfoWindow(target: any, idx: number) {
        const id = tags.current[selectedRef.current];
        const nines = index.current.get(id);
        if (nines == undefined || nines.length <= idx) { return }

        const data = nines[idx];
        const ids = (appContext.adminEnabled) ? `${data.visitorid} ipid: ${data.id}<br />` : "";
        infoWindow.current.setContent(`
                        <div>
                            ${ids}
                            city: ${data.city}<br/>
                            state: ${data.state}<br/>
                            domain: ${data.domain}<br/>
                            type: ${data.type}
                        </div>
                    `);
        infoWindow.current.open({
            anchor: target,
            map,
        });
    }

    async function renderMarkers() {
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary; 
        
        if (infoWindow.current == null) {
            const { InfoWindow } = await google.maps.importLibrary("maps")            
            infoWindow.current = new InfoWindow();
        }

        const id = tags.current[selected];
        const nines = index.current.get(id);

        if (!nines) { return; }

        for (let i = 0; i < nines.length; i++) {
            let marker;
            if (markers.current.length > i) {
                marker = markers.current[i];
                marker.id = "marker-" + i;
            } else {
                marker = new AdvancedMarkerElement({});
                marker.gmpClickable = true;
                marker.id = "marker-" + i;
                marker.addEventListener("gmp-click", (evt) => {
                    const id = evt.target?.id;
                    if (id == null || id.length < 7) { return; }
                    const idx = Number.parseInt(id.substring(7));
                    openInfoWindow(evt.target, idx);
                });
                markers.current.push(marker);
            }
            
            marker.position = {
                lat: Number.parseFloat(nines[i].lat),
                lng: Number.parseFloat(nines[i].lon)
            };
            marker.map = map.current;
        }

        for (let i = nines.length; i < markers.current.length; i++) {
            markers.current[i].setMap(null)
        };
    }

    function dateToAgo(date: number): string {
        const dt = new Date(date);
        return dt.toString();
    }

    async function setBestOf(commentid: number, bestof: boolean) {
        if (appContext.adminBackend?.adminToken == null) {
            return;
        }

        const id = tags.current[selected];
        const comments = commentIndex.current.get(id);

        if (!comments) { return }

        const comment = comments.find((line) => {return line.id == commentid})
        if (comment == undefined) { return; }

        let url = env.api + "/comment/bestOf/" + comment.id + "/" + appContext.adminBackend.adminToken;

        const res = await fetch(url, {
            method: 'POST',
            credentials: "include",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({value: bestof})
        });
        comment.bestof = bestof;
        setUpdate(new Date().getTime());
    }

    function renderQuotes() {
        const updated = update;
        const id = tags.current[selected];
        const comments = commentIndex.current.get(id);

        if (!comments) { return <></>}


        return (<div style={{background: "#FFFFFF"}}>
            {comments.map((localComment) => {
                const indent = 20;
                let commentClass = "comment";
                const name = (localComment.name) ? localComment.name : "anon";
                let nameClass = "name"
                const time = dateToAgo(localComment.posted);
                
                return (
                    <div className={commentClass} key={"comment-" + localComment.id} id={localComment.id.toString()} 
                        style={{ marginLeft: indent + "px" }}
                    >
                        <div className="commentLeft">
                            <div className='header'>
                                {(appContext.adminEnabled) ? (
                                    <input type="checkbox" onClick={
                                        () => {setBestOf(localComment.id, !localComment.bestof)}
                                    } checked={localComment.bestof}></input>
                                ) : <></>}
                                <span className={nameClass}>
                                    {(appContext.adminEnabled) ? (<span>{localComment.visitorid} -</span>) : <></>}
                                    {name}</span>
                                <span className='time'>{time}</span>
                            </div>
                            {localComment.comment}
                        </div>
                    </div>
                )}
            )}
        </div>)
    }

    return (<>
        {renderSelector()}
        <div style={{width: 800, height: 600}} id="map"/>
        {renderQuotes()}
    </>)
}