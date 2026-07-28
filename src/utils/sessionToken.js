import crypto from 'crypto';

export const hashSessionToken = (token = '') => (
    crypto.createHash('sha256').update(String(token)).digest('hex')
);

export const sessionTokenRecord = (token = '') => {
    const tokenHash = hashSessionToken(token);
    return { token: `v2:${tokenHash}`, tokenHash };
};

export const sessionTokenQuery = (token = '') => {
    const raw = String(token || '');
    if (!raw) return { _id: null };
    return {
        $or: [
            { tokenHash: hashSessionToken(raw) },
            { token: raw, tokenHash: { $exists: false } }
        ]
    };
};
