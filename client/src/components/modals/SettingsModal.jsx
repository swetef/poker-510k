import React from 'react';
import { Settings, X } from 'lucide-react';
import { RoomSettingsForm } from '../game/RoomSettingsForm.jsx';
import css from './SettingsModal.module.css';

export const SettingsModal = ({ isOpen, onClose, config, onChange, readOnly }) => {
    if (!isOpen) return null;

    return (
        <div className={css.modalOverlay}>
            <div className={css.modalContent}>
                <div className={css.modalHeader}>
                    <div style={{display:'flex', alignItems:'center', gap:8, fontSize:18, fontWeight:'bold', color:'#2c3e50'}}>
                        <Settings size={20}/> 房间规则设置
                    </div>
                    <button onClick={onClose} className={css.closeBtn}>
                        <X size={20} color="#999"/>
                    </button>
                </div>

                <div className={css.modalBody}>
                    <RoomSettingsForm 
                        config={config} 
                        onChange={onChange} 
                        readOnly={readOnly} 
                    />
                </div>

                <div className={css.modalFooter}>
                    <button className={css.primaryButton} onClick={onClose}>
                        完成设置
                    </button>
                </div>
            </div>
        </div>
    );
};