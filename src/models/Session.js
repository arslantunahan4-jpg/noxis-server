import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true, select: false },
    tokenHash: { type: String, unique: true, sparse: true, select: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '30d' },
    ip: String,
    userAgent: String
});

export const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);
