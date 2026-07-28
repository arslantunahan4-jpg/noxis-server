import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true, 
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    email: { 
        type: String, 
        unique: true, 
        sparse: true, 
        lowercase: true, 
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Please fill a valid email address']
    },
    role: { 
        type: String, 
        enum: ['user', 'admin', 'moderator'], 
        default: 'user' 
    },
    // Authentication
    hash: { type: String, required: true, select: false },
    salt: { type: String, select: false },
    password: { type: String, select: false },
    
    // 2FA / Security
    isTwoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false }, // Store encrypted in production!
    twoFactorBackupCodes: [{ type: String, select: false }],
    
    // Audit & Status
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String },
    
    lastLogin: { type: Date },
    loginHistory: [{
        ip: String,
        userAgent: String,
        timestamp: { type: Date, default: Date.now },
        status: { type: String, enum: ['success', 'failed'] }
    }],
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    
    // App specific
    watchHistory: { type: Object, default: {} },
    preferences: {
        theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
        notifications: { type: Boolean, default: true }
    },
    // Social Profile
    avatarId: { type: String, default: '' },
    bio: { type: String, maxlength: 120, default: '' },
    profileVisibility: {
        type: String,
        enum: ['public', 'friends', 'private'],
        default: 'public'
    },
    onlineStatus: {
        isOnline: { type: Boolean, default: false },
        lastSeen: { type: Date },
        currentlyWatching: {
            title: { type: String, default: '' },
            imdbId: { type: String, default: '' },
            poster: { type: String, default: '' },
            season: Number,
            episode: Number,
            updatedAt: Date
        }
    }
}, {
    timestamps: true
});

// Don't return sensitive data by default
UserSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.hash;
    delete user.salt;
    delete user.password;
    delete user.twoFactorSecret;
    delete user.twoFactorBackupCodes;
    return user;
};

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
