const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
const auth = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseBody = (body = {}) => {
  const payload = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 80) return { error: 'Name must be 2–80 characters.' };
    payload.name = name;
  }
  if (body.description !== undefined) payload.description = String(body.description).trim().slice(0, 300);
  if (body.image !== undefined) payload.image = String(body.image).trim().slice(0, 500);
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 1 || price > 100000) return { error: 'Price must be between 1 and 100000.' };
    payload.price = price;
  }
  if (body.available !== undefined) payload.available = Boolean(body.available);
  if (body.categoryId !== undefined) payload.categoryId = body.categoryId || null;
  if (body.pizza !== undefined) {
    const pizza = body.pizza;
    const list = (value) => (Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean).slice(0, 20) : null);
    const composed = {
      base: String(pizza.base || '').trim(),
      sauce: String(pizza.sauce || '').trim(),
      cheese: String(pizza.cheese || '').trim(),
      veggies: list(pizza.veggies) ?? [],
    };
    if (!composed.base || !composed.sauce || !composed.cheese) {
      return { error: 'Base, sauce and cheese are required for a pizza.' };
    }
    payload.pizza = composed;
  }
  return { payload };
};

// @route   GET /api/products?search=&page=&limit=
// @desc    Admin: product list (includes unavailable)
router.get('/', auth, adminMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = {};
    const search = String(req.query.search || '').trim();
    if (search) filter.name = new RegExp(escapeRegex(search), 'i');
    if (req.query.available === 'true') filter.available = true;
    if (req.query.available === 'false') filter.available = false;
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('categoryId', 'name slug')
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    console.error('Products list error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   POST /api/products
// @desc    Admin: create a preset pizza
router.post('/', auth, adminMiddleware, async (req, res) => {
  try {
    const { payload, error } = parseBody(req.body);
    if (error) return res.status(400).json({ message: error });
    if (!payload.name || payload.price === undefined || !payload.pizza) {
      return res.status(400).json({ message: 'Name, price and composition are required.' });
    }

    const existing = await Product.findOne({ name: payload.name });
    if (existing) return res.status(400).json({ message: 'A product with this name already exists.' });

    const product = await Product.create(payload);
    res.status(201).json(product);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(' ') });
    }
    console.error('Product create error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   PUT /api/products/:id
// @desc    Update price / availability / description / composition / category (admin)
router.put('/:id', auth, adminMiddleware, async (req, res) => {
  try {
    const { payload, error } = parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const product = await Product.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json(product);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid product id.' });
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors).map((e) => e.message).join(' ') });
    }
    console.error('Product update error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   DELETE /api/products/:id
// @desc    Admin: delete a preset (orders keep their price snapshot)
router.delete('/:id', auth, adminMiddleware, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json({ message: `"${product.name}" deleted. Past orders keep their snapshot.` });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid product id.' });
    console.error('Product delete error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ---- Categories -----------------------------------------------------------

// @route   GET /api/products/categories/list
// @desc    Admin: all categories (active + inactive)
router.get('/categories/list', auth, adminMiddleware, async (req, res) => {
  try {
    const categories = await ProductCategory.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   POST /api/products/categories
// @desc    Admin: create a category
router.post('/categories', auth, adminMiddleware, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ message: 'Category name must be 2–60 characters.' });
    }
    const existing = await ProductCategory.findOne({ name });
    if (existing) return res.status(400).json({ message: 'Category already exists.' });

    const category = await ProductCategory.create({
      name,
      sortOrder: Number(req.body?.sortOrder) || 0,
    });
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Category already exists.' });
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors).map((e) => e.message).join(' ') });
    }
    console.error('Category create error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   PUT /api/products/categories/:id
// @desc    Admin: rename / activate / reorder a category
router.put('/categories/:id', auth, adminMiddleware, async (req, res) => {
  try {
    const payload = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 60) {
        return res.status(400).json({ message: 'Category name must be 2–60 characters.' });
      }
      payload.name = name;
      payload.slug = '';
    }
    if (req.body?.active !== undefined) payload.active = Boolean(req.body.active);
    if (req.body?.sortOrder !== undefined) payload.sortOrder = Number(req.body.sortOrder) || 0;

    const category = await ProductCategory.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
      runValidatorsOnSet: false,
    });
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    res.json(category);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid category id.' });
    if (error.code === 11000) return res.status(400).json({ message: 'Category name already in use.' });
    console.error('Category update error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   DELETE /api/products/categories/:id
// @desc    Admin: delete a category (products become uncategorised)
router.delete('/categories/:id', auth, adminMiddleware, async (req, res) => {
  try {
    const category = await ProductCategory.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    await Product.updateMany({ categoryId: category._id }, { $unset: { categoryId: '' } });
    res.json({ message: `Category "${category.name}" deleted.` });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid category id.' });
    console.error('Category delete error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
