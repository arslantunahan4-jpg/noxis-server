import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import logger from '../utils/logger.js';

export const adminMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            logger.warn('Admin access attempt without token', { ip: req.ip });
            return res.status(401).json({ error: 'Authentication required' });
        }

        const session = await Session.findOne({ token });
        if (!session) {
            logger.warn('Admin access attempt with invalid token', { ip: req.ip, token: token.substring(0, 10) + '...' });
            return res.status(403).json({ error: 'Session expired or invalid' });
        }

        const user = await User.findById(session.userId);
        if (!user) {
            logger.error('Session found but user does not exist', { sessionId: session._id, userId: session.userId });
            return res.status(403).json({ error: 'User not found' });
        }

        if (user.role !== 'admin') {
            logger.warn('Unauthorized admin access attempt', { username: user.username, role: user.role, ip: req.ip });
            return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
        }
        
        logger.info('Admin access granted', { 
            username: user.username, 
            path: req.path, 
            method: req.method,
            ip: req.ip 
        });

        req.user = user;
        next();
    } catch (error) {
        logger.error('Admin Middleware Error', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
