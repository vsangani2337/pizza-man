// Phase 3 API test suite — runs against a dedicated test database.
// Usage: npm test (from /server). NODE_ENV=test disables the global rate limiter.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/pizzaDB_test';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../server');
const connectDB = require('../config/db');
const { ensureSeedData } = require('../seed/seed');

// Supertest mounts the express app directly — no listening port needed.
const call = (method, path) => request(app)[method](path);

let userToken = '';
let adminToken = '';
let userId = '';
let productId = '';
let inventoryItemId = '';
const testEmail = `test+${Date.now()}@example.com`;

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

before(async () => {
  process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pizzaDB_test';
  await connectDB();
  await mongoose.connection.dropDatabase();
  await ensureSeedData();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('GET /api/settings returns public store settings', async () => {
  const res = await call('get', '/api/settings').expect(200);
  assert.equal(typeof res.body.taxRate, 'number');
  assert.equal(typeof res.body.storeOpen, 'boolean');
  assert.ok(res.body.storeName);
});

test('PUT /api/settings validates numeric ranges (admin)', async () => {
  const login = await call('post', '/api/auth/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    .expect(200);
  adminToken = login.body.token;
  assert.ok(adminToken);

  await call('put', '/api/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ taxRate: 150 })
    .expect(400);
});

test('PUT /api/settings updates and reflects values (admin)', async () => {
  await call('put', '/api/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ taxRate: 5, minOrderAmount: 100 })
    .expect(200);

  const res = await call('get', '/api/settings').expect(200);
  assert.equal(res.body.taxRate, 5);
  assert.equal(res.body.minOrderAmount, 100);

  // restore defaults for later tests
  await call('put', '/api/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ taxRate: 0, minOrderAmount: 0 })
    .expect(200);
});

test('settings PUT requires admin', async () => {
  await call('put', '/api/settings').send({ taxRate: 1 }).expect(401);
});

test('GET /api/pizza/menu returns products, categories and ingredients', async () => {
  const res = await call('get', '/api/pizza/menu')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.ok(Array.isArray(res.body.products));
  assert.ok(res.body.products.length >= 4);
  assert.ok(Array.isArray(res.body.categories));
  assert.ok(res.body.bases.length > 0);
  productId = String(res.body.products[0]._id);
});

test('protected route rejects missing token', async () => {
  await call('get', '/api/orders').expect(401);
});

test('register + login + me round trip', async () => {
  const register = await call('post', '/api/auth/register')
    .send({ name: 'API Tester', email: testEmail, password: 'Sup3rSecret!' })
    .expect(201);
  assert.match(register.body.message, /verify/i);

  // Login requires a verified email; the test suite verifies directly in the DB
  // instead of relying on SMTP delivery.
  const User = require('../models/User');
  await User.updateOne({ email: testEmail }, { $set: { isVerified: true } });

  const login = await call('post', '/api/auth/login')
    .send({ email: testEmail, password: 'Sup3rSecret!' })
    .expect(200);
  assert.ok(login.body.token);
  userToken = login.body.token;

  const me = await call('get', '/api/auth/me')
    .set('Authorization', `Bearer ${userToken}`)
    .expect(200);
  userId = String(me.body.user.id);
  assert.equal(me.body.user.email, testEmail);
});

test('non-admin cannot use admin routes', async () => {
  await call('get', '/api/users').set('Authorization', `Bearer ${userToken}`).expect(403);
  await call('get', '/api/analytics').set('Authorization', `Bearer ${userToken}`).expect(403);
});

test('GET /api/auth/profile returns profile shape', async () => {
  const res = await call('get', '/api/auth/profile')
    .set('Authorization', `Bearer ${userToken}`)
    .expect(200);
  assert.ok(res.body.user.name);
  assert.equal(res.body.user.email, testEmail);
  assert.ok(Array.isArray(res.body.addresses));
  assert.ok(Array.isArray(res.body.favorites));
});

test('PUT /api/auth/profile updates name/phone', async () => {
  const res = await call('put', '/api/auth/profile')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ name: 'API Tester Updated', phone: '9876543210' })
    .expect(200);
  assert.equal(res.body.user.name, 'API Tester Updated');
});

test('PUT /api/auth/addresses enforces defaults and validation', async () => {
  const res = await call('put', '/api/auth/addresses')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      addresses: [
        { label: 'Home', line1: '12 MG Road', city: 'Bengaluru', pincode: '560001' },
        { label: 'Work', line1: '42 Church Street', city: 'Bengaluru', pincode: '560001' },
      ],
    })
    .expect(200);
  assert.equal(res.body.addresses.length, 2);
  assert.equal(res.body.addresses.filter((a) => a.isDefault).length, 1);

  await call('put', '/api/auth/addresses')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ addresses: [{ label: 'Bad', line1: '1', city: 'X', pincode: '560001' }] })
    .expect(400);
});

test('PUT /api/auth/change-password requires current password', async () => {
  await call('put', '/api/auth/change-password')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ currentPassword: 'WrongPass1!', newPassword: 'An0therPass!' })
    .expect(400);

  await call('put', '/api/auth/change-password')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ currentPassword: 'Sup3rSecret!', newPassword: 'An0therPass!' })
    .expect(200);
});

test('favorites toggle adds and removes a product', async () => {
  const add = await call('post', `/api/auth/favorites/${productId}`)
    .set('Authorization', `Bearer ${userToken}`)
    .expect(200);
  assert.equal(add.body.favorited, true);

  const list = await call('get', '/api/auth/favorites')
    .set('Authorization', `Bearer ${userToken}`)
    .expect(200);
  assert.ok(list.body.some((f) => String(f._id) === productId));

  const remove = await call('post', `/api/auth/favorites/${productId}`)
    .set('Authorization', `Bearer ${userToken}`)
    .expect(200);
  assert.equal(remove.body.favorited, false);
});

test('quote prices an order server-side and includes the store block', async () => {
  const res = await call('post', '/api/payment/quote')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      items: [
        { type: 'pizza', base: 'Thin Crust', sauce: 'Marinara', cheese: 'Mozzarella', veggies: ['Tomatoes'], addons: ['Extra Cheese'], size: 'large', quantity: 2 },
        { type: 'drink', name: 'Classic Cola', quantity: 1 },
      ],
    })
    .expect(200);

  assert.ok(res.body.summary.subtotal > 0);
  assert.equal(typeof res.body.summary.tax, 'number');
  assert.ok(res.body.store);
  assert.equal(typeof res.body.store.storeOpen, 'boolean');
  assert.equal(res.body.store.minOrderAmount, 0);
});

test('quote rejects invalid size and quantity', async () => {
  await call('post', '/api/payment/quote')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ items: [{ type: 'pizza', base: 'Thin Crust', sauce: 'Marinara', cheese: 'Mozzarella', size: 'jumbo', quantity: 1 }] })
    .expect(400);

  await call('post', '/api/payment/quote')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ items: [{ type: 'drink', name: 'Classic Cola', quantity: 999 }] })
    .expect(400);
});

test('create-order is blocked while the store is closed', async () => {
  await call('put', '/api/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ storeOpen: false })
    .expect(200);

  await call('post', '/api/payment/create-order')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      items: [{ type: 'drink', name: 'Classic Cola', quantity: 1 }],
      customer: { name: 'API Tester', phone: '9876543210', address: '12 MG Road, Bengaluru' },
    })
    .expect(403);

  await call('put', '/api/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ storeOpen: true })
    .expect(200);
});

test('create-order enforces the minimum order amount', async () => {
  await call('put', '/api/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ minOrderAmount: 100000 })
    .expect(200);

  const res = await call('post', '/api/payment/create-order')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      items: [{ type: 'drink', name: 'Classic Cola', quantity: 1 }],
      customer: { name: 'API Tester', phone: '9876543210', address: '12 MG Road, Bengaluru' },
    });
  assert.equal(res.status, 400);

  await call('put', '/api/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ minOrderAmount: 0 })
    .expect(200);
});

test('GET /api/products returns paginated admin list', async () => {
  const res = await call('get', '/api/products?page=1&limit=2')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.ok(Array.isArray(res.body.products));
  assert.equal(res.body.page, 1);
  assert.equal(typeof res.body.total, 'number');
  assert.ok(res.body.products.length <= 2);
});

test('product create / update / delete cycle with validation', async () => {
  await call('post', '/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'No Composition Pizza', price: 100 })
    .expect(400);

  const created = await call('post', '/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: `Test Pizza ${Date.now()}`,
      price: 250,
      description: 'Created by the API test suite',
      pizza: { base: 'Thin Crust', sauce: 'Marinara', cheese: 'Mozzarella', veggies: ['Tomatoes'] },
    })
    .expect(201);
  const id = created.body._id;

  const updated = await call('put', `/api/products/${id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ price: 275, available: false })
    .expect(200);
  assert.equal(updated.body.price, 275);
  assert.equal(updated.body.available, false);

  await call('delete', `/api/products/${id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
});

test('categories CRUD', async () => {
  const created = await call('post', '/api/products/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `Test Category ${Date.now()}` })
    .expect(201);

  const list = await call('get', '/api/products/categories/list')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.ok(Array.isArray(list.body));
  assert.ok(list.body.some((c) => String(c._id) === String(created.body._id)));

  await call('delete', `/api/products/categories/${created.body._id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
});

test('inventory list shape + restock increments stock', async () => {
  const res = await call('get', '/api/inventory?page=1&limit=5')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.ok(Array.isArray(res.body.items));
  assert.ok(res.body.items.length > 0);
  assert.ok(typeof res.body.threshold === 'number');
  inventoryItemId = res.body.items[0]._id;
  const beforeQty = res.body.items[0].quantity;

  const stats = await call('get', '/api/inventory/stats')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.equal(typeof stats.body.totalItems, 'number');

  const restocked = await call('post', `/api/inventory/${inventoryItemId}/restock`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ quantity: 5 })
    .expect(200);
  assert.equal(restocked.body.quantity, beforeQty + 5);

  await call('post', `/api/inventory/${inventoryItemId}/restock`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ quantity: 0 })
    .expect(400);

  const log = await call('get', '/api/inventory/log?limit=5')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.ok(Array.isArray(log.body.entries));
  assert.ok(log.body.entries.some((e) => e.reason === 'restock'));
});

test('GET /api/analytics returns totals and validates range', async () => {
  const res = await call('get', `/api/analytics?from=${daysAgo(6)}&to=${daysAgo(0)}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.equal(typeof res.body.totals.revenue, 'number');
  assert.equal(typeof res.body.totals.orders, 'number');
  assert.ok(Array.isArray(res.body.series));
  assert.ok(Array.isArray(res.body.topProducts));

  await call('get', '/api/analytics?from=2020-01-01&to=2030-01-01')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(400);
});

test('GET /api/users lists accounts without secrets', async () => {
  const res = await call('get', '/api/users?search=API&page=1&limit=10')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.ok(Array.isArray(res.body.users));
  const target = res.body.users.find((u) => u.email === testEmail);
  assert.ok(target, 'created test user should be listed');
  assert.equal(target.password, undefined);
  assert.equal(typeof target.isActive, 'boolean');
});

test('user detail + stats', async () => {
  const res = await call('get', `/api/users/${userId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.ok(res.body.user);
  assert.equal(res.body.user.email, testEmail);
  assert.equal(typeof res.body.stats.orders, 'number');
});

test('order status transitions are enforced server-side', async () => {
  const Order = require('../models/Order');
  const order = await Order.create({
    user: new mongoose.Types.ObjectId(),
    items: [
      {
        type: 'drink',
        name: 'Classic Cola',
        quantity: 1,
        unitPrice: 60,
        subtotal: 60,
        customization: null,
      },
    ],
    customer: { name: 'Transition Test', phone: '9876543210', address: '5 Test Lane, Bengaluru' },
    subtotal: 60,
    totalPrice: 60,
    paymentStatus: 'paid',
    status: 'Order Placed',
  });

  // invalid jump: Order Placed -> Delivered
  await call('put', `/api/orders/${order._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'Delivered' })
    .expect(400);

  // valid: Order Placed -> Order Received
  await call('put', `/api/orders/${order._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'Order Received' })
    .expect(200);

  // invalid: Order Received -> Delivered
  await call('put', `/api/orders/${order._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'Delivered' })
    .expect(400);

  // valid: Order Received -> In the Kitchen
  const ok = await call('put', `/api/orders/${order._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'In the Kitchen' })
    .expect(200);
  assert.equal(ok.body.status, 'In the Kitchen');
});

test('admin cannot change their own account', async () => {
  const me = await call('get', '/api/auth/me')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  const adminId = String(me.body.user.id);

  const res = await call('put', `/api/users/${adminId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ isActive: false })
    .expect(400);
  assert.match(res.body.message, /your own account/i);
});

test('GET /api/orders returns paginated admin list with statusFlow', async () => {
  const res = await call('get', '/api/orders?page=1&limit=5')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.ok(Array.isArray(res.body.orders));
  assert.ok(Array.isArray(res.body.statusFlow));
  assert.equal(typeof res.body.total, 'number');
});
