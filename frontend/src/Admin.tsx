import React, { JSX, useRef, useState } from "react";

import { AdminMain } from "./AdminMain";
import { AdminFilters } from "./AdminFilters";
import { Link } from "react-router";

interface Tab {
    name: string,
    content: () => JSX.Element
}

interface AdminProps {
}

export const AdminPanel:React.FC<AdminProps> = ({
}:AdminProps) => {
    const [selected, setSelected] = useState(0);

    function openMap() {
        
    }

    const tabs = useRef<Tab[]>([
        { name: "Admin", content: () => {return (<AdminMain  />)}},
        { name: "Filters", content: () => {return (<AdminFilters />)}},
        { name: "Links", content: () => {return (
            <div>
                <Link to="/map">User map</Link><br/><br/>
                <Link to="/dump">Comment dump</Link>
            </div>
        )}}
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
