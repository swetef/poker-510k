import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useGame } from '../../context/GameContext';

/**
 * 横屏引导组件
 * 纯展示组件，自身管理简单的显隐交互
 */
export const LandscapeHint = () => {
    return (
        <div className="landscape-hint">
            <div className="phone-rotate-icon"></div>
            <h3 style={{marginBottom: 10, fontSize: 18}}>建议使用横屏游玩</h3>
            <p style={{fontSize: 14, opacity: 0.8, maxWidth: 250}}>
                510K 需要较大的展示空间。<br/>
                请旋转您的手机以获得最佳体验。
            </p>
            <button 
                style={{marginTop: 20, padding: '8px 20px', background: 'rgba(255,255,255,0.2)', color:'white', border:'1px solid white'}}
                onClick={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
            >
                我非要竖屏玩
            </button>
        </div>
    );
};

/**
 * 断线重连提示组件
 * 直接消费 GameContext，即插即用
 */
export const DisconnectAlert = () => {
    const { isConnected } = useGame();

    if (isConnected) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: 'rgba(231, 76, 60, 0.95)', color: 'white', padding: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)', backdropFilter: 'blur(5px)',
            fontSize: 13, fontWeight: '500'
        }}>
            <WifiOff size={16} className="pulse-icon" />
            <span>网络连接已断开，正在尝试自动恢复...</span>
            
            <button 
                onClick={() => window.location.reload()} 
                style={{
                    background: 'white', color: '#e74c3c', border: 'none', 
                    borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 'bold',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    marginLeft: 10
                }}
            >
                <RefreshCw size={12} /> 立即刷新
            </button>
            <style>{`.pulse-icon { animation: pulse 1.5s infinite; } @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
        </div>
    );
};