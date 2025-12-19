import React, { useEffect, useRef, useState } from 'react'; 
import { History, ChevronDown, ChevronUp } from 'lucide-react'; 
import css from './GameLogPanel.module.css';

export const GameLogPanel = ({ logs }) => {
    const [isCollapsed, setIsCollapsed] = useState(false); 
    const endRef = useRef(null);

    useEffect(() => {
        if (!isCollapsed) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isCollapsed]);

    const panelClasses = [
        css.panel,
        isCollapsed ? css.panelCollapsed : css.panelExpanded
    ].join(' ');

    return (
        <div 
            className={panelClasses}
            onClick={() => setIsCollapsed(!isCollapsed)} 
        >
            <div className={css.header}>
                <History size={14} color="#f1c40f" /> 
                <span style={{color:'#fff', fontWeight:'bold', flex: 1}}>
                    对局记录
                </span>
                {isCollapsed ? <ChevronDown size={14} color="#ccc"/> : <ChevronUp size={14} color="#ccc"/>}
            </div>
            
            <div className={isCollapsed ? css.listHidden : css.list}>
                {logs.map((log, i) => (
                    <div key={i} className={css.logItem}>
                        <span className={css.logTime}>[{log.time.split(' ')[0]}]</span>
                        <span style={{color: '#eee'}}>{log.text}</span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
};