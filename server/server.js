const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const pizzaRoutes = require('./routes/pizza');
const orderRoutes = require('./routes/order');
const paymentRoutes = require('./routes/payment');
const inventoryRoutes = require('./routes/inventory');
const productRoutes = require('./routes/products');
const settingsRoutes = require('./routes/settings');
const analyticsRoutes = require('./routes/analytics');
const userRoutes = require('./routes/users');
const { ensureSeedData } = require('./seed/seed');

const app = express();

// --- Startup configuration checks -----------------------------------------
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set. Add it to server/.env — the server cannot start without it.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️  JWT_SECRET is shorter than 32 characters. Use a long random string before deploying.');
}
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not set. Add it to server/.env — the server cannot start without it.');
  process.exit(1);
}

// --- Middleware ------------------------------------------------------------
// Reflect the configured frontend origin(s); never credentials (we use Bearer tokens).
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: false,
}));

if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// Security headers (API-only responses; Razorpay script lives on the client origin).
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Strip `$`/`.` operators from user input (NoSQL injection protection).
app.use(mongoSanitize());

// Coarse global throttle; auth/payment routes have their own stricter limits.
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down and try again shortly.' },
  }));
}

app.use(express.json({ limit: '1mb' }));
app.disable('x-powered-by');

// --- Routes ----------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/pizza', pizzaRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- Error handling --------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found.' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON body.' });
  }
  console.error('Unhandled error:', err);
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Something went wrong on our end.'
      : err.message || 'Something went wrong on our end.';
  res.status(err.status || 500).json({ message });
});

const PORT = process.env.PORT || 5001;

const start = async () => {
  try {
    await connectDB();
    await ensureSeedData();

    const server = app.listen(PORT, () => {
      console.log(`🍕 Server running on port ${PORT}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Stop the other process or change PORT in server/.env.`);
      } else {
        console.error('❌ Server failed to start:', error.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = app;

// Handle clean process termination (helps prevent port locking during watch restarts)
process.on('SIGINT', () => {
  console.log('\nShutting down server cleanly...');
  process.exit(0);
});
