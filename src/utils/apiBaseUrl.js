const trimTrailingSlash = (url = '') => String(url || '').replace(/\/+$/, '');

const isLocalHost = (hostname = '') => {
    const normalized = String(hostname || '').toLowerCase();
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
};

const isPrivateNetworkHost = (hostname = '') => {
    const normalized = String(hostname || '').toLowerCase();
    return normalized.startsWith('10.') ||
        normalized.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
};

const isLocalEnvironmentUrl = (value = '') => {
    try {
        const parsed = new URL(value);
        return isLocalHost(parsed.hostname) || isPrivateNetworkHost(parsed.hostname);
    } catch (error) {
        return false;
    }
};

const isDeadApiHost = (value = '') => {
    try {
        return new URL(value).hostname === 'api.noxis.tech';
    } catch (error) {
        return false;
    }
};

const getRuntimeApiUrl = () => {
    try {
        if (typeof window === 'undefined') return '';
        return window.__NOXIS_CONFIG__?.API_URL || window.__NOXIS_API_URL__ || '';
    } catch (error) {
        return '';
    }
};

export const getApiBaseUrl = () => {
    try {
        if (typeof window !== 'undefined') {
            const hostname = window.location?.hostname || '';
            const savedUrl = window.localStorage?.getItem('noxis_api_url');

            if (isLocalHost(hostname)) {
                if (savedUrl && isLocalEnvironmentUrl(savedUrl)) {
                    return trimTrailingSlash(savedUrl);
                }
                if (savedUrl) {
                    window.localStorage?.removeItem('noxis_api_url');
                }
                return 'http://localhost:3000';
            }

            if (savedUrl && isDeadApiHost(savedUrl)) {
                window.localStorage?.removeItem('noxis_api_url');
            } else if (savedUrl) {
                return trimTrailingSlash(savedUrl);
            }

            const runtimeApiUrl = getRuntimeApiUrl();
            if (runtimeApiUrl) {
                return trimTrailingSlash(runtimeApiUrl);
            }

        }
    } catch (error) {}

    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
        return trimTrailingSlash(import.meta.env.VITE_API_URL);
    }

    try {
        if (typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) {
            return trimTrailingSlash(window.location.origin);
        }
    } catch (error) {}

    return 'http://localhost:3000';
};
