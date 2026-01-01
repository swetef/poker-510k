import React, { useState } from 'react';
import css from './QuickChatPanel.module.css';
import { CHAT_CATEGORIES } from '../../utils/chatConfig.js';
import { useGame } from '../../context/GameContext.jsx';

export const QuickChatPanel = ({ onClose }) => {
    const { handleSendQuickChat } = useGame();
    const [activeTab, setActiveTab] = useState(CHAT_CATEGORIES[0].id);

    const onSend = (msg) => {
        handleSendQuickChat(msg);
        onClose();
    };

    const currentCategory = CHAT_CATEGORIES.find(c => c.id === activeTab);

    return (
        <>
            <div className={css.closeArea} onClick={onClose}></div>
            <div className={css.overlay}>
                <div className={css.header}>
                    {CHAT_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            className={activeTab === cat.id ? css.tabActive : css.tab}
                            onClick={() => setActiveTab(cat.id)}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
                
                <div className={css.content}>
                    {currentCategory.messages.map((msg, i) => (
                        <button key={i} className={css.msgBtn} onClick={() => onSend(msg)}>
                            {msg}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
};