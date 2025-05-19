import React, { useContext, useEffect, useRef, useState } from "react";
import { AppContext, AppUpdateContext } from "./App";
import { Filter } from "./AdminTools";
import useMount from "./useMount";

interface AdminFiltersProps {
}

export const AdminFilters: React.FC<AdminFiltersProps> = ({
}: AdminFiltersProps) => {
    const appContext = useContext(AppContext);
    const appUpdateContext = useContext(AppUpdateContext);
    const [filters, setFilters] = useState<Filter[]>([]);

    useEffect(() => {
        setFilters(appContext.adminBackend?.filters ?? []);
    }, [appUpdateContext.triggerAdminUpdate]);

    useMount(() => {
        const arr = appContext.adminBackend?.filters ?? []
        setFilters(arr);
    })

    function addEntry() {
        filters.push({pattern: "", replace: ""});
        setFilters([... filters]);
    }

    return (<table className="filterList">
        <thead className="filter"><tr><td>revert</td><td>search</td><td>replace</td><td>Edit</td></tr></thead>
        <tbody>
            {filters.map((filter, idx) => { return (
                <AdminFilter filter={filter} key={idx} />
            )})}
            <tr><td colSpan={4}><button onClick={() => {addEntry()}}>+</button></td></tr>
        </tbody>
    </table>)
}

interface AdminFilterProps {
    filter: Filter
}
const AdminFilter: React.FC<AdminFilterProps> = ({
    filter
}: AdminFilterProps) => {
    const appContext = useContext(AppContext);
    const [pattern, setPattern] = useState(filter.pattern);
    const [replace, setreplace] = useState(filter.replace);

    function onPatternChange(value:string) {
        setPattern(value);
    }

    function onReplaceChange(value: string) {
        setreplace(value);
    }

    function isChanged():boolean {
        if (pattern == filter.pattern && replace == filter.replace) {
            return false;
        }

        if (filter.pattern == "" && pattern == "" &&
            filter.replace == "" && replace == ""
        ) {
            return false;
        }

        return true;
    }

    function commit() {
        if (!isChanged()) {return;}
        const commit = confirm("Save filter " + pattern + " -> " + replace);
        if (!commit) { return; }
        const api = appContext.adminBackend;
        if (!api) { return; }

        const newFilter: Filter = {
            pattern: pattern,
            replace: replace,
            id: filter.id
        }

        if (filter.id) {
            api.updateFilter(newFilter);
        } else {
            api.addFilter(newFilter);
        }
    }

    function revert() {
        setPattern(filter.pattern);
        setreplace(filter.replace);
    }

    function renderButton() {
        if (!isChanged()) {
            return (<></>);
        }

        return (
            <button onClick={() => commit()}>E</button>
        )
    }

    function renderRevertButton() {
        if (!isChanged()) {
            return (<></>)
        }

        return (
            <button onClick={() => revert()}>R</button>
        )
    }

    return (<tr className="filter">
        <td>{renderRevertButton()}</td>
        <td><input type="text" value={pattern} onChange={(evt) => onPatternChange(evt.target.value)}/></td>
        <td><input type="text" value={replace} onChange={(evt) => onReplaceChange(evt.target.value)} /></td>
        <td>{renderButton()}</td>
    </tr>)
}