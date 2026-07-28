import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/apiBaseUrl';

const API_URL = getApiBaseUrl();

const BACKDROPS = [
    "https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg", // The Last of Us
    "https://image.tmdb.org/t/p/original/s16H6tpK2utvwDtzZ8Qy4qm5Emw.jpg", // Avatar 2
    "https://image.tmdb.org/t/p/original/5i6SjyDbDWqyun8klUuCxrlFbyw.jpg", // Creed III
    "https://image.tmdb.org/t/p/original/ovM06PdF3M8wvKb06i4sjW3xoww.jpg"  // Avatar Way of Water
];

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [backdropIndex, setBackdropIndex] = useState(0);
    const navigate = useNavigate();

    // Rotate Backdrops
    useEffect(() => {
        const interval = setInterval(() => {
            setBackdropIndex(prev => (prev + 1) % BACKDROPS.length);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const isDevMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
            const payload = {
                username: formData.username,
                password: formData.password || (isDevMode ? 'dev' : '')
            };
            if (!isLogin) {
                payload.email = formData.email;
            }

            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(data.error || 'İşlem başarısız');

            if (data.token) localStorage.setItem('noxis_auth_token', data.token);
            if (data.user) localStorage.setItem('noxis_user', JSON.stringify(data.user));
            
            // Redirect with animation delay
            setTimeout(() => {
                window.location.href = '/'; 
            }, 500);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDevQuickLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'dev' })
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(data.error || 'İşlem başarısız');

            if (data.token) localStorage.setItem('noxis_auth_token', data.token);
            if (data.user) localStorage.setItem('noxis_user', JSON.stringify(data.user));
            
            setTimeout(() => {
                window.location.href = '/'; 
            }, 500);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100dvh',
            width: '100vw',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000'
        }}>
            {/* Dynamic Background Slideshow */}
            <AnimatePresence mode='wait'>
                <motion.div
                    key={backdropIndex}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 0.6, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5 }}
                    style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `url('${BACKDROPS[backdropIndex]}')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'brightness(0.6)'
                    }}
                />
            </AnimatePresence>

            {/* Gradient Overlay */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle at center, transparent 0%, #000 120%)',
                pointerEvents: 'none'
            }} />

            {/* Auth Card */}
            <motion.div 
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{
                    zIndex: 10,
                    width: '100%',
                    maxWidth: '420px',
                    padding: '48px',
                    background: 'rgba(20, 20, 25, 0.75)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ 
                        margin: 0, 
                        fontSize: '36px', 
                        fontWeight: '900', 
                        background: 'linear-gradient(135deg, #c471ed 0%, #f64f59 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '-1px'
                    }}>
                        NOXIS
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '8px' }}>
                        Sinemanın Yeni Adresi
                    </p>
                </div>

                <AnimatePresence mode='wait'>
                    <motion.div
                        key={isLogin ? 'login' : 'register'}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <h2 style={{ color: 'white', marginBottom: '24px', fontSize: '24px', fontWeight: '600' }}>
                            {isLogin ? 'Tekrar Hoş Geldiniz' : 'Hesap Oluşturun'}
                        </h2>

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{
                                    background: 'rgba(232, 124, 3, 0.15)',
                                    border: '1px solid rgba(232, 124, 3, 0.3)',
                                    color: '#ff9f43',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    marginBottom: '20px',
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <i className="fas fa-exclamation-circle"></i>
                                {error}
                            </motion.div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="input-group">
                                <div style={{ 
                                    position: 'relative', 
                                    background: 'rgba(255,255,255,0.05)', 
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    transition: 'all 0.2s'
                                }}>
                                    <i className="fas fa-user" style={{ position: 'absolute', left: '16px', top: '18px', color: 'rgba(255,255,255,0.4)' }}></i>
                                    <input
                                        type="text"
                                        placeholder="Kullanıcı Adı"
                                        value={formData.username}
                                        onChange={e => setFormData({...formData, username: e.target.value})}
                                        style={{
                                            width: '100%',
                                            padding: '16px 16px 16px 48px',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '15px',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {!isLogin && (
                                <div className="input-group">
                                    <div style={{ 
                                        position: 'relative', 
                                        background: 'rgba(255,255,255,0.05)', 
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        transition: 'all 0.2s'
                                    }}>
                                        <i className="fas fa-envelope" style={{ position: 'absolute', left: '16px', top: '18px', color: 'rgba(255,255,255,0.4)' }}></i>
                                        <input
                                            type="email"
                                            placeholder="E-posta Adresi"
                                            value={formData.email}
                                            onChange={e => setFormData({...formData, email: e.target.value})}
                                            style={{
                                                width: '100%',
                                                padding: '16px 16px 16px 48px',
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'white',
                                                fontSize: '15px',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                            
                            <div className="input-group">
                                <div style={{ 
                                    position: 'relative', 
                                    background: 'rgba(255,255,255,0.05)', 
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    transition: 'all 0.2s'
                                }}>
                                    <i className="fas fa-lock" style={{ position: 'absolute', left: '16px', top: '18px', color: 'rgba(255,255,255,0.4)' }}></i>
                                    <input
                                        type="password"
                                        placeholder={isDevMode ? "Parola (Geliştirici Modu - İsteğe Bağlı)" : "Parola"}
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        style={{
                                            width: '100%',
                                            padding: '16px 16px 16px 48px',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '15px',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            <motion.button 
                                type="submit" 
                                disabled={loading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
                                    color: '#000',
                                    border: 'none',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    fontWeight: '700',
                                    marginTop: '12px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.7 : 1,
                                    boxShadow: '0 8px 20px -6px rgba(161, 140, 209, 0.5)'
                                }}
                            >
                                {loading ? (
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        <i className="fas fa-circle-notch fa-spin"></i> İşleniyor...
                                    </span>
                                ) : (
                                    isLogin ? 'Giriş Yap' : 'Kayıt Ol'
                                )}
                            </motion.button>

                            {(import.meta.env.DEV || isDevMode) && isLogin && (
                                <motion.button 
                                    type="button" 
                                    onClick={handleDevQuickLogin}
                                    whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.08)' }}
                                    whileTap={{ scale: 0.98 }}
                                    style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        color: '#b19ffb',
                                        border: '1px dashed rgba(177, 159, 251, 0.4)',
                                        padding: '14px',
                                        borderRadius: '12px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        marginTop: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <i className="fas fa-terminal"></i> Hızlı Geliştirici Girişi (Şifresiz)
                                </motion.button>
                            )}
                        </form>

                        <div style={{ marginTop: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                            {isLogin ? (
                                <>
                                    Hesabınız yok mu?{' '}
                                    <button 
                                        onClick={() => setIsLogin(false)}
                                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: '600', marginLeft: '4px' }}
                                    >
                                        Kayıt Olun
                                    </button>
                                </>
                            ) : (
                                <>
                                    Zaten üye misiniz?{' '}
                                    <button 
                                        onClick={() => setIsLogin(true)}
                                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: '600', marginLeft: '4px' }}
                                    >
                                        Giriş Yapın
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default AuthPage;
