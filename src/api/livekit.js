import { AccessToken } from 'livekit-server-sdk';
import dotenv from 'dotenv';
dotenv.config();

const createToken = async (req, res) => {
    const { roomName, participantName } = req.body;

    if (!roomName || !participantName) {
        return res.status(400).json({ error: 'Oda adı ve katılımcı adı gerekli' });
    }

    // Load from ENV (Secure)
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
        return res.status(500).json({ error: 'LiveKit sunucu ayarları eksik' });
    }

    try {
        const at = new AccessToken(apiKey, apiSecret, {
            identity: participantName,
        });

        // Grant Permissions
        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
        });

        const token = await at.toJwt();

        res.json({
            token,
            wsUrl // Client needs this too
        });
    } catch (e) {
        console.error('LiveKit Token Error:', e);
        res.status(500).json({ error: 'Token oluşturulamadı' });
    }
};

export default createToken;
