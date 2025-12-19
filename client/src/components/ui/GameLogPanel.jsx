import React, { useEffect, useRef, useState } from 'react'; 
import { History, ChevronDown, ChevronUp } from 'lucide-react'; 
import { styles } from '../../styles.js';

export const GameLogPanel = ({ logs }) => {
    const [isCollapsed, setIsCollapsed] = useState(false); 
    const endRef = useRef(null);

    useEffect(() => {
        if (!isCollapsed) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isCollapsed]);

    return (
        <div 
            style={{
                ...styles.gameLogPanel,
                zIndex: 1000,
                height: isCollapsed ? 36 : 140, 
                background: 'transparent', 
                backdropFilter: 'none',
                border: isCollapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: 'none',
                cursor: 'pointer',
                textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.8)'
            }}
            onClick={() => setIsCollapsed(!isCollapsed)} 
        >
            <div style={styles.logHeader}>
                <History size={14} color="#f1c40f" style={{filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'}}/> 
                <span style={{color:'#fff', fontWeight:'bold', flex: 1}}>
                    对局记录
                </span>
                {isCollapsed ? <ChevronDown size={14} color="#ccc" style={{filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'}}/> : <ChevronUp size={14} color="#ccc" style={{filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'}}/>}
            </div>
            
            <div style={{
                ...styles.logList, 
                opacity: isCollapsed ? 0 : 1,
                pointerEvents: isCollapsed ? 'none' : 'auto'
            }}>
                {logs.map((log, i) => (
                    <div key={i} style={styles.logItem}>
                        <span style={styles.logTime}>[{log.time.split(' ')[0]}]</span>
                        <span style={{color: '#eee'}}>{log.text}</span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
};