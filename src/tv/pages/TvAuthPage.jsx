import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../../utils/apiBaseUrl';
import { preloadImages } from '../utils/tmdbCache';
import { setStoredAvatar } from '../../config/avatars';

const API_URL = getApiBaseUrl();

const BACKDROPS = [
    'https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
    'https://image.tmdb.org/t/p/original/s16H6tpK2utvwDtzZ8Qy4qm5Emw.jpg',
    'https://image.tmdb.org/t/p/original/5i6SjyDbDWqyun8klUuCxrlFbyw.jpg',
    'https://image.tmdb.org/t/p/original/ovM06PdF3M8wvKb06i4sjW3xoww.jpg'
];

const TvAuthPage = () => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [backdropIndex, setBackdropIndex] = useState(0);
    const [formData, setFormData] = useState({ username: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setBackdropIndex((value) => (value + 1) % BACKDROPS.length);
        }, 8500);
        return () => window.clearInterval(timer);
    }, []);

    const activeBackdrop = BACKDROPS[backdropIndex % BACKDROPS.length];

    useEffect(() => {
        preloadImages([
            activeBackdrop,
            BACKDROPS[(backdropIndex + 1) % BACKDROPS.length]
        ], 2);
    }, [activeBackdrop, backdropIndex]);

    const heading = useMemo(() => (
        isLogin ? 'Oturum Aç' : 'Hesap Oluştur'
    ), [isLogin]);

    const handleChange = (field) => (event) => {
        setFormData((value) => ({ ...value, [field]: event.target.value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
            const payload = {
                username: formData.username.trim(),
                password: formData.password
            };

            if (!isLogin) {
                payload.email = formData.email.trim();
            }

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Oturum açılamadı');
            }

            localStorage.setItem('noxis_auth_token', data.token);
            localStorage.setItem('noxis_auth_verified_at', String(Date.now()));
            if (data.user) {
                localStorage.setItem('noxis_user', JSON.stringify(data.user));
                if (data.user.avatarId) setStoredAvatar(data.user.avatarId);
            }

            window.dispatchEvent(new CustomEvent('noxis-auth-changed'));
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message || 'Sunucu hatası');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            className="tv-auth-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
        >
            <AnimatePresence initial={false}>
                <motion.div
                    key={activeBackdrop}
                    className="tv-auth-bg"
                    style={{ backgroundImage: `url("${activeBackdrop}")` }}
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                />
            </AnimatePresence>
            <div className="tv-auth-vignette" />

            <section className="tv-auth-stage">
                <motion.div
                    className="tv-auth-brand"
                    initial={{ opacity: 0, x: -34 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.26, delay: 0.04 }}
                >
                    <span>NOXIS TV</span>
                    <h1>Sinematik izleme deneyimi</h1>
                    <p>Büyük ekranda izlemeye devam et.</p>
                </motion.div>

                <motion.form
                    className="tv-auth-panel"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0, x: 42, scale: 0.985 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.28, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                >
                    <div className="tv-auth-tabs" role="tablist" aria-label="Oturum türü" data-tv-focus-group="tv-auth-tabs" data-tv-focus-axis="horizontal">
                        <button
                            type="button"
                            className={`focusable tv-auth-tab ${isLogin ? 'active' : ''}`}
                            data-tv-autofocus="true"
                            data-focus-id="tv-auth-login-tab"
                            data-tv-focus-index="0"
                            onClick={() => {
                                setIsLogin(true);
                                setError(null);
                            }}
                        >
                            Giriş
                        </button>
                        <button
                            type="button"
                            className={`focusable tv-auth-tab ${!isLogin ? 'active' : ''}`}
                            data-focus-id="tv-auth-register-tab"
                            data-tv-focus-index="1"
                            onClick={() => {
                                setIsLogin(false);
                                setError(null);
                            }}
                        >
                            Kayıt
                        </button>
                    </div>

                    <div className="tv-auth-head">
                        <span>{isLogin ? 'Tekrar hoş geldiniz' : 'Yeni profil'}</span>
                        <h2>{heading}</h2>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                className="tv-auth-error"
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                            >
                                <i className="fas fa-triangle-exclamation" />
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="tv-auth-fields">
                        <label className="tv-auth-field" data-tv-focus-group="tv-auth-username-group" data-tv-focus-axis="horizontal">
                            <i className="fas fa-user" />
                            <input
                                className="focusable"
                                data-focus-id="tv-auth-username"
                                data-tv-focus-index="0"
                                aria-label="Kullanıcı adı"
                                type="text"
                                value={formData.username}
                                onChange={handleChange('username')}
                                placeholder="Kullanıcı adı"
                                autoComplete="username"
                                required
                            />
                        </label>

                        {!isLogin && (
                            <label className="tv-auth-field" data-tv-focus-group="tv-auth-email-group" data-tv-focus-axis="horizontal">
                                <i className="fas fa-envelope" />
                                <input
                                    className="focusable"
                                    data-focus-id="tv-auth-email"
                                    data-tv-focus-index="0"
                                    aria-label="E-posta"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange('email')}
                                    placeholder="E-posta"
                                    autoComplete="email"
                                    required
                                />
                            </label>
                        )}

                        <label className="tv-auth-field" data-tv-focus-group="tv-auth-password-group" data-tv-focus-axis="horizontal">
                            <i className="fas fa-lock" />
                            <input
                                className="focusable"
                                data-focus-id="tv-auth-password"
                                data-tv-focus-index="0"
                                aria-label="Parola"
                                type="password"
                                value={formData.password}
                                onChange={handleChange('password')}
                                placeholder="Parola"
                                autoComplete={isLogin ? 'current-password' : 'new-password'}
                                required
                            />
                        </label>
                    </div>

                    <button
                        type="submit"
                        className="focusable tv-auth-submit"
                        data-focus-id="tv-auth-submit"
                        data-tv-focus-group="tv-auth-submit-group"
                        data-tv-focus-axis="horizontal"
                        data-tv-focus-index="0"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <i className="fas fa-circle-notch fa-spin" />
                                <span>İşleniyor</span>
                            </>
                        ) : (
                            <>
                                <i className="fas fa-arrow-right" />
                                <span>{isLogin ? 'Giriş Yap' : 'Kaydı Tamamla'}</span>
                            </>
                        )}
                    </button>
                </motion.form>
            </section>
        </motion.div>
    );
};

export default TvAuthPage;
