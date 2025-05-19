import React, { JSX, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "./App";
import { UserData } from "./AdminTools";
import { AdminMain } from "./AdminMain";
import { AdminFilters } from "./AdminFilters";

interface Tab {
    name: string,
    content: () => JSX.Element
}

interface AdminProps {
}

export const AdminPanel:React.FC<AdminProps> = ({
}:AdminProps) => {
    const [selected, setSelected] = useState(0);

    const tabs = useRef<Tab[]>([
        { name: "Admin", content: () => {return (<AdminMain  />)}},
        { name: "Filters", content: () => {return (<AdminFilters />)}}
    ]);

    function tabClicked(index: number) {
        setSelected(index);
    }

    function renderTabs():JSX.Element[] {
        return (tabs.current.map((tab, idx) => {
            let className = "tab";
            if (idx == selected) {
                className += " selected";
            }
            return (
                <div 
                    className={className}
                    onClick={() => tabClicked(idx)}
                >
                    {tab.name}
                </div>
            )
        }))
    }

    function renderPages() {
        return (tabs.current.map((tab, idx) => {
            if (idx != selected) {
                return (<div className="page" />)
            }

            return (<div className="page selected">
                {tab.content()}
            </div> )
        }));
    }

    return (
        <div className="adminTabs">
            <div className="tabs">
                {renderTabs()}
            </div>
            <div className="pages">
                {renderPages()}
            </div>
        </div>
    )
}
