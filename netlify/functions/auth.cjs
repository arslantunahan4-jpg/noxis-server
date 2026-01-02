const crypto = require('crypto');
const mongoose = require('mongoose');

// TMDB API Key
const TMDB_API_KEY = 'db8ab9e44da4236102fadf5d58a08a4b';

// MongoDB Connection String - Set MONGODB_URI in Netlify Env Vars
// Fallback is valid but will fail if not set
const MONGODB_URI = process.env.MONGODB_URI;

// Cached Connection
let cachedDb = null;

const connectToDatabase = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    const db = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    cachedDb = db;
    return db;
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    throw error;
  }
};

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const SessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '30d' } // Auto expire after 30 days
});

// Avoid recompiling models on hot reload/cold start
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);

// Helper functions
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

const generateSessionToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  // Config: Is DB connected?
  const isDbConfigured = !!MONGODB_URI;

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/auth', '').replace('/api/auth', '');
  const body = event.body ? JSON.parse(event.body) : {};

  // If No DB Configured, return specific error
  if (!isDbConfigured) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Veritabanı bağlantısı yapılandırılmamış (MONGODB_URI eksik)' })
    };
  }

  // Connect to DB before processing
  try {
    await connectToDatabase();
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Veritabanı bağlantı hatası' })
    };
  }

  try {
    // Register
    if (path === '/register' && event.httpMethod === 'POST') {
      const { username, password } = body;

      if (!username || !password) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Kullanıcı adı ve şifre gerekli' }) };
      }
      if (username.length < 3) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'En az 3 karakter' }) };
      }
      if (password.length < 6) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'En az 6 karakter' }) };
      }

      // Check existing
      const existingUser = await User.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Kullanıcı adı dolu' }) };
      }

      const newUser = await User.create({
        username: username.toLowerCase(),
        password: hashPassword(password)
      });

      // Auto login
      const token = generateSessionToken();
      await Session.create({ token, userId: newUser._id, username: newUser.username });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, token, user: { id: newUser._id, username: newUser.username } })
      };
    }

    // Login
    if (path === '/login' && event.httpMethod === 'POST') {
      const { username, password } = body;

      const user = await User.findOne({
        username: username.toLowerCase(),
        password: hashPassword(password)
      });

      if (!user) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Hatalı giriş' }) };
      }

      const token = generateSessionToken();
      await Session.create({ token, userId: user._id, username: user.username });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, token, user: { id: user._id, username: user.username } })
      };
    }

    // Verify session
    if (path === '/verify' && event.httpMethod === 'POST') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const token = authHeader?.replace('Bearer ', '') || body.token;

      if (!token) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Token yok' }) };
      }

      const session = await Session.findOne({ token }).populate('userId');
      if (!session) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Geçersiz oturum' }) };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, user: { username: session.username } })
      };
    }

    // Logout
    if (path === '/logout' && event.httpMethod === 'POST') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const token = authHeader?.replace('Bearer ', '') || body.token;

      if (token) {
        await Session.deleteOne({ token });
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true })
      };
    }

    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Not found' }) };

  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Sunucu hatası: ' + error.message })
    };
  }
};
