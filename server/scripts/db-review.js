// Phase 3 DB review: collections, indexes, and basic data integrity.
// Usage: node scripts/db-review.js   (uses MONGO_URI from server/.env)
require('dotenv').config();
const mongoose = require('mongoose');
require('../models/User');
require('../models/Order');
require('../models/Product');
require('../models/Inventory');

const run = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pizzaDB';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`\nDatabase: ${db.databaseName}\n`);

  const collections = await db.listCollections().toArray();
  for (const { name } of collections) {
    const coll = db.collection(name);
    const count = await coll.countDocuments();
    const indexes = await coll.indexes();
    console.log(`• ${name} (${count} docs)`);
    for (const index of indexes) {
      console.log(`    - ${index.name}: ${JSON.stringify(index.key)}${index.unique ? ' [unique]' : ''}`);
    }
  }

  console.log('\nIntegrity checks:');

  const orders = mongoose.connection.model('Order');
  const users = mongoose.connection.model('User');
  const products = mongoose.connection.model('Product');
  const inventory = mongoose.connection.model('Inventory');

  const orphanOrders = await orders.countDocuments({ user: { $exists: true, $nin: (await users.find({}, { _id: 1 }).lean()).map((u) => u._id) } });
  console.log(`  - Orders whose user no longer exists: ${orphanOrders}`);

  const allUsers = await users.find({}, { favorites: 1 }).lean();
  const productIds = new Set((await products.find({}, { _id: 1 }).lean()).map((p) => String(p._id)));
  let danglingFavorites = 0;
  for (const user of allUsers) {
    for (const favorite of user.favorites || []) {
      if (!productIds.has(String(favorite))) danglingFavorites += 1;
    }
  }
  console.log(`  - Dangling favorites (product deleted): ${danglingFavorites}`);

  const negativeStock = await inventory.countDocuments({ quantity: { $lt: 0 } });
  console.log(`  - Inventory items with negative stock: ${negativeStock}`);

  const duplicateNames = await inventory.aggregate([
    { $group: { _id: { category: '$category', name: '$name' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  console.log(`  - Duplicate inventory names within a category: ${duplicateNames.length}`);

  const invalidStatus = await orders.countDocuments({
    status: { $nin: ['Order Placed', 'Order Received', 'In the Kitchen', 'Sent to Delivery', 'Delivered', 'Cancelled'] },
  });
  console.log(`  - Orders with an unknown status: ${invalidStatus}`);

  const uncategorized = await products.countDocuments({ categoryId: null });
  console.log(`  - Products without a category: ${uncategorized}`);

  await mongoose.disconnect();
  console.log('\nReview complete.');
};

run().catch((error) => {
  console.error('DB review failed:', error.message);
  process.exit(1);
});
