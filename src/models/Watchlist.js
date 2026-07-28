import mongoose from 'mongoose';

const WatchlistItemSchema = new mongoose.Schema({
    tmdbId: { type: String, required: true },
    mediaType: { type: String, enum: ['movie', 'tv'], required: true },
    title: { type: String, required: true },
    posterPath: { type: String },
    backdropPath: { type: String },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now },
    watchedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const WatchlistSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    coverImage: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    items: [WatchlistItemSchema]
}, { timestamps: true });

export const Watchlist = mongoose.model('Watchlist', WatchlistSchema);
