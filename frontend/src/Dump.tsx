import { useState } from "react"
import useMount from "./useMount";
import env from "../../env"

export default function DumpView() {
    const [data, setData] = useState<any[]>([]);

    useMount(() => {
        const delayed = async () => {
            const url = env.api + "/commmentData/all";
            const res = await fetch(url);
            const json = await res.json();
            setData(json);
        }

        delayed();
    })

    return (
        <table style={{background: "#FFFFFF"}}>
            <thead><tr>
                <td>id</td>
                <td>posted</td>
                <td>name</td>
                <td style={{ maxWidth: 200 }}>comment</td>
                <td>domain</td>
                <td>isVPN</td>
                <td>country</td>
                <td>state</td>
                <td>city</td>
            </tr></thead>
            <tbody>
                {data.map((line) => { return (
                    <tr>
                        <td>{line.visitorid}</td>
                        <td>{line.posted}</td>
                        <td>{line.name}</td>
                        <td style={{ maxWidth: 200 }}>{line.comment}</td>
                        <td>{line.domain}</td>
                        <td>{(line.type == "isp") ? "" : "X"}</td>
                        <td>{line.country}</td>
                        <td>{line.state}</td>
                        <td>{line.city}</td>
                    </tr>
                )})}
            </tbody>
        </table>
    )
}