import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['recommendation', 'watchlist_invite', 'system'], required: true },
    data: {
        tmdbId: String,
        mediaType: String,
        title: String,
        posterPath: String,
        message: String,
        watchlistId: String
    },
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

export const Notification = mongoose.model('Notification', NotificationSchema);
