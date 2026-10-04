// Vercel serverless entry — reuses the Express app from server/server.js.
// The DB connection is established lazily on the first request (cold start).
const connectDB = require('../server/config/db');
const { ensureSeedData } = require('../server/seed/seed');
const app = require('../server/server');

let ready = null;

const ensureReady = () => {
  if (!ready) {
    ready = (async () => {
      await connectDB();
      await ensureSeedData();
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
};

module.exports = async (req, res) => {
  await ensureReady();
  return app(req, res);
};
