import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVATARS, AVATAR_CATEGORIES, getStoredAvatar, setStoredAvatar } from '../config/avatars';

export const AvatarSelectorModal = ({ isOpen, onClose, onAvatarChanged }) => {
    const [selected, setSelected] = useState(() => getStoredAvatar());
    const [activeCategory, setActiveCategory] = useState('all');

    if (!isOpen) return null;

    const filteredAvatars = activeCategory === 'all'
        ? AVATARS
        : AVATARS.filter(a => a.category === activeCategory);

    const handleSelect = (avatar) => {
        setSelected(avatar);
    };

    const handleSave = () => {
        setStoredAvatar(selected.id);
        onAvatarChanged?.(selected);
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="noxis-modal-overlay" onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 20 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="noxis-avatar-modal"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="noxis-avatar-header">
                        <div>
                            <h2>Profil Resmini Seç</h2>
                            <p>Seni temsil edecek ikonik karakter avatarını seç</p>
                        </div>
                        <button type="button" className="noxis-modal-close" onClick={onClose}>
                            <i className="fas fa-times" />
                        </button>
                    </div>

                    {/* Active Preview */}
                    <div className="noxis-avatar-preview-box">
                        <div
                            className="noxis-avatar-preview-circle"
                            style={{ background: selected.gradient }}
                        >
                            {selected.url ? (
                                <img
                                    src={selected.url}
                                    alt={selected.name}
                                    referrerPolicy="no-referrer"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <span>{selected.name.charAt(0)}</span>
                            )}
                        </div>
                        <div className="noxis-avatar-preview-info">
                            <h3>{selected.name}</h3>
                            <span>Seçili Karakter</span>
                        </div>
                    </div>

                    {/* Category Tabs */}
                    <div className="noxis-avatar-tabs">
                        {AVATAR_CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                className={`noxis-avatar-tab ${activeCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat.id)}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Avatar Grid */}
                    <div className="noxis-avatar-grid">
                        {filteredAvatars.map((avatar) => {
                            const isSelected = selected.id === avatar.id;
                            return (
                                <button
                                    key={avatar.id}
                                    type="button"
                                    className={`noxis-avatar-card ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleSelect(avatar)}
                                    title={avatar.name}
                                >
                                    <div
                                        className="noxis-avatar-circle"
                                        style={{ background: avatar.gradient }}
                                    >
                                        {avatar.url ? (
                                            <img
                                                src={avatar.url}
                                                alt={avatar.name}
                                                referrerPolicy="no-referrer"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <span>{avatar.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    {isSelected && (
                                        <div className="noxis-avatar-check">
                                            <i className="fas fa-check" />
                                        </div>
                                    )}
                                    <span className="noxis-avatar-name">{avatar.name}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer Actions */}
                    <div className="noxis-avatar-footer">
                        <button type="button" className="noxis-btn-cancel" onClick={onClose}>
                            Vazgeç
                        </button>
                        <button type="button" className="noxis-btn-save" onClick={handleSave}>
                            Kaydet ve Uygula
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
