import mongoose from 'mongoose';

const ArchiveSchema = new mongoose.Schema({
    tmdbId: { type: String, required: true },
    title: String,
    type: { type: String, enum: ['movie', 'tv'] },
    season: Number,
    episode: Number,
    files: [{
        fileId: String,
        part: Number,
        name: String,
        size: Number
    }],
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    retryCount: { type: Number, default: 0 },
    lastError: String,
    completedAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ArchiveSchema.index({ tmdbId: 1, season: 1, episode: 1 }, { unique: true });
ArchiveSchema.index({ status: 1, createdAt: 1 });
ArchiveSchema.index({ title: 1 });

ArchiveSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

export const ArchivedContent = mongoose.models.ArchivedContent || mongoose.model('ArchivedContent', ArchiveSchema);
