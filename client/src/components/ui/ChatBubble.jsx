import React from 'react';
import css from './ChatBubble.module.css';

export const ChatBubble = ({ message }) => {
    if (!message) return null;

    return (
        <div className={css.bubbleContainer}>
            <div className={css.bubbleBody}>
                {message}
                <div className={css.bubbleArrow}></div>
            </div>
        </div>
    );
};