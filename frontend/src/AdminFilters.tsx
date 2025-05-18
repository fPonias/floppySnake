import React, { useContext, useRef, useState } from "react";
import { AppContext } from "./App";
import { Filter } from "./AdminTools";
import useMount from "./useMount";

interface AdminFiltersProps {

}

export const AdminFilters: React.FC<AdminFiltersProps> = ({

}: AdminFiltersProps) => {
    const appContext = useContext(AppContext);
    const [filters, setFilters] = useState<Filter[]>([]);
    const [update, setupUpdate] = useState(1);

    useMount(() => {
        const arr = appContext.adminBackend?.filters ?? []

        for (let filter of filters) {
            arr.push({... filter})
        }

        setFilters(arr);
    })

    function addEntry() {
        filters.push({pattern: "", replacement: ""});
        setupUpdate(Math.round(Math.random() * Number.MAX_SAFE_INTEGER));
    }

    return (<div className="filterList">
        <div className="filter"><div>search</div><div>replace</div><div>Edit</div></div>
        {filters.map((filter, idx) => {
            return (<div key={idx} className="filter">
                <div><input type="text" value={filter.pattern} /></div>
                <div><input type="text" value={filter.replacement} /></div>
                <div><button>E</button></div>
            </div>)
        })}
        <div><button onClick={() => {addEntry()}}>+</button></div>
    </div>)
}