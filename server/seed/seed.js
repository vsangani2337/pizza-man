const mongoose = require('mongoose');
const path = require('path');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');

// Single source of truth for the starter catalogue.
// `npm run seed` and server auto-seed both use this exact dataset.
// Existing items are never overwritten, so admin edits are preserved.
const items = [
  { category: 'base', name: 'Thin Crust', quantity: 100, price: 120, image: '🫓' },
  { category: 'base', name: 'Thick Crust', quantity: 100, price: 140, image: '🍞' },
  { category: 'base', name: 'Stuffed Crust', quantity: 100, price: 180, image: '🥐' },
  { category: 'base', name: 'Gluten-Free', quantity: 100, price: 200, image: '🌾' },
  { category: 'base', name: 'Whole Wheat', quantity: 100, price: 150, image: '🌿' },
  { category: 'base', name: 'Hand Tossed', quantity: 100, price: 160, image: '🍕' },
  { category: 'base', name: 'Cheese Burst Crust', quantity: 100, price: 220, image: '🧈' },
  { category: 'base', name: 'Multigrain Crust', quantity: 100, price: 170, image: '🌾' },
  { category: 'base', name: 'Garlic Crust', quantity: 100, price: 175, image: '🧄' },
  { category: 'base', name: 'Sourdough Crust', quantity: 100, price: 190, image: '🥖' },

  { category: 'sauce', name: 'Marinara', quantity: 100, price: 40, image: '🍅' },
  { category: 'sauce', name: 'BBQ', quantity: 100, price: 50, image: '🔥' },
  { category: 'sauce', name: 'Alfredo', quantity: 100, price: 60, image: '🥛' },
  { category: 'sauce', name: 'Pesto', quantity: 100, price: 55, image: '🌿' },
  { category: 'sauce', name: 'Hot Sauce', quantity: 100, price: 45, image: '🌶️' },
  { category: 'sauce', name: 'Arrabbiata', quantity: 100, price: 55, image: '🍅' },
  { category: 'sauce', name: 'Garlic Parmesan', quantity: 100, price: 65, image: '🧄' },
  { category: 'sauce', name: 'Chipotle', quantity: 100, price: 60, image: '🌶️' },
  { category: 'sauce', name: 'Tandoori', quantity: 100, price: 65, image: '🍛' },
  { category: 'sauce', name: 'Creamy Herb', quantity: 100, price: 58, image: '🌿' },

  { category: 'cheese', name: 'Mozzarella', quantity: 100, price: 80, image: '🧀' },
  { category: 'cheese', name: 'Cheddar', quantity: 100, price: 90, image: '🧀' },
  { category: 'cheese', name: 'Parmesan', quantity: 100, price: 100, image: '🧀' },
  { category: 'cheese', name: 'Gouda', quantity: 100, price: 110, image: '🧀' },
  { category: 'cheese', name: 'Vegan Cheese', quantity: 100, price: 120, image: '🌱' },
  { category: 'cheese', name: 'Provolone', quantity: 100, price: 95, image: '🧀' },
  { category: 'cheese', name: 'Ricotta', quantity: 100, price: 105, image: '🧀' },
  { category: 'cheese', name: 'Feta', quantity: 100, price: 110, image: '🧀' },
  { category: 'cheese', name: 'Monterey Jack', quantity: 100, price: 100, image: '🧀' },
  { category: 'cheese', name: 'Blue Cheese', quantity: 100, price: 115, image: '🧀' },

  { category: 'veggie', name: 'Mushrooms', quantity: 100, price: 30, image: '🍄' },
  { category: 'veggie', name: 'Bell Peppers', quantity: 100, price: 25, image: '🫑' },
  { category: 'veggie', name: 'Onions', quantity: 100, price: 20, image: '🧅' },
  { category: 'veggie', name: 'Olives', quantity: 100, price: 35, image: '🫒' },
  { category: 'veggie', name: 'Tomatoes', quantity: 100, price: 25, image: '🍅' },
  { category: 'veggie', name: 'Jalapeños', quantity: 100, price: 30, image: '🌶️' },
  { category: 'veggie', name: 'Spinach', quantity: 100, price: 25, image: '🥬' },
  { category: 'veggie', name: 'Corn', quantity: 100, price: 20, image: '🌽' },
  { category: 'veggie', name: 'Broccoli', quantity: 100, price: 30, image: '🥦' },
  { category: 'veggie', name: 'Paneer', quantity: 100, price: 45, image: '🧀' },
  { category: 'veggie', name: 'Zucchini', quantity: 100, price: 35, image: '🥒' },
  { category: 'veggie', name: 'Baby Corn', quantity: 100, price: 30, image: '🌽' },
  { category: 'veggie', name: 'Sun-dried Tomatoes', quantity: 100, price: 40, image: '🍅' },

  { category: 'meat', name: 'Pepperoni', quantity: 100, price: 60, image: '🥓' },
  { category: 'meat', name: 'Chicken', quantity: 100, price: 70, image: '🍗' },
  { category: 'meat', name: 'Sausage', quantity: 100, price: 65, image: '🌭' },
  { category: 'meat', name: 'Bacon', quantity: 100, price: 75, image: '🥓' },

  { category: 'drink', name: 'Classic Cola', quantity: 100, price: 60, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&q=80' },
  { category: 'drink', name: 'Iced Peach Tea', quantity: 100, price: 80, image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300&q=80' },
  { category: 'drink', name: 'Cold Brew Coffee', quantity: 100, price: 120, image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&q=80' },
  { category: 'drink', name: 'Mango Smoothie', quantity: 100, price: 110, image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=300&q=80' },
  { category: 'drink', name: 'Strawberry Milkshake', quantity: 100, price: 130, image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=300&q=80' },

  { category: 'addon', name: 'Extra Cheese', quantity: 100, price: 40, image: '🧀' },
  { category: 'addon', name: 'Garlic Dip', quantity: 100, price: 25, image: '🧄' },
  { category: 'addon', name: 'Chili Dip', quantity: 100, price: 25, image: '🌶️' },
  { category: 'addon', name: 'Herb Seasoning', quantity: 100, price: 20, image: '🌿' },
];

// Preset pizzas. `price` is the server price for the default (medium) size;
// sizes scale it via config/sizes.js. Composition drives stock checks + reorder.
const products = [
  {
    name: 'Margherita Classic',
    description: 'The simple Italian classic with fresh mozzarella and ripe tomatoes.',
    image: 'margherita',
    price: 290,
    pizza: { base: 'Thin Crust', sauce: 'Marinara', cheese: 'Mozzarella', veggies: ['Tomatoes', 'Spinach'] },
  },
  {
    name: 'Double Pepperoni',
    description: 'Double the crispy pepperoni with rich cheese and smoky sauce.',
    image: 'pepperoni',
    price: 415,
    pizza: { base: 'Thick Crust', sauce: 'BBQ', cheese: 'Cheddar', veggies: ['Pepperoni', 'Bacon'] },
  },
  {
    name: 'Veggie Supreme',
    description: 'Loaded with a colorful variety of fresh, crisp garden vegetables.',
    image: 'veggie',
    price: 420,
    pizza: { base: 'Whole Wheat', sauce: 'Pesto', cheese: 'Parmesan', veggies: ['Mushrooms', 'Olives', 'Tomatoes', 'Bell Peppers'] },
  },
  {
    name: 'BBQ Chicken Delight',
    description: 'Succulent chunks of chicken tossed in sweet barbecue sauce.',
    image: 'bbq_chicken',
    price: 430,
    pizza: { base: 'Stuffed Crust', sauce: 'BBQ', cheese: 'Mozzarella', veggies: ['Chicken', 'Onions', 'Jalapeños'] },
  },
];

/**
 * Inserts any missing catalogue items (never overwrites existing rows)
 * and ensures the admin account exists when ADMIN_EMAIL/ADMIN_PASSWORD are set.
 */
const ensureSeedData = async ({ log = true } = {}) => {
  let inserted = 0;

  for (const item of items) {
    const exists = await Inventory.findOne({ category: item.category, name: item.name }).select('_id');
    if (!exists) {
      await Inventory.create(item);
      inserted += 1;
    }
  }

  let productsInserted = 0;
  let categoryCreated = false;
  let signatureCategory = await ProductCategory.findOne({ name: 'Signature Pizzas' });
  if (!signatureCategory) {
    signatureCategory = await ProductCategory.create({ name: 'Signature Pizzas', sortOrder: 0 });
    categoryCreated = true;
  }
  for (const product of products) {
    const exists = await Product.findOne({ name: product.name }).select('_id');
    if (!exists) {
      await Product.create({ ...product, categoryId: signatureCategory._id });
      productsInserted += 1;
    }
  }
  // Backfill categoryId for products created before categories existed.
  await Product.updateMany({ categoryId: null }, { $set: { categoryId: signatureCategory._id } });

  let adminCreated = false;
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail) {
    const adminExists = await User.findOne({ email: adminEmail }).select('_id');
    if (!adminExists) {
      if (adminPassword) {
        try {
          await User.create({
            name: process.env.ADMIN_NAME || 'Admin',
            email: adminEmail,
            password: adminPassword,
            role: 'admin',
            isVerified: true,
          });
          adminCreated = true;
        } catch (error) {
          console.error(`Could not create admin account: ${error.message}`);
        }
      } else if (log) {
        console.warn(
          `⚠️  No admin account found for ${adminEmail}. Set ADMIN_PASSWORD in server/.env and restart to create it.`
        );
      }
    }
  } else if (log) {
    console.warn('⚠️  ADMIN_EMAIL is not set — skipping admin account creation.');
  }

  if (log) {
    const parts = [];
    if (inserted) parts.push(`${inserted} new catalogue item(s) added`);
    if (productsInserted) parts.push(`${productsInserted} new product(s) added`);
    if (categoryCreated) parts.push('product category created');
    if (adminCreated) parts.push('admin account created');
    console.log(`Seed: ${parts.length ? parts.join(', ') : 'already up to date'}.`);
  }

  return { inserted, productsInserted, categoryCreated, adminCreated };
};

module.exports = { items, products, ensureSeedData };

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('Connected to MongoDB for seeding...');
      await ensureSeedData();
      console.log('Seed complete!');
      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Seed error:', error.message);
      process.exit(1);
    }
  })();
}
