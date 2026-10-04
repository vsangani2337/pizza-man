const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
const auth = require('../middleware/auth');
const { getSizes } = require('../config/sizes');

const buildCategoryRegex = (aliases) => new RegExp(`^(${aliases.join('|')})$`, 'i');

const findByCategory = async (aliases) => {
  const categoryRegex = buildCategoryRegex(aliases);
  return Inventory.find({ category: categoryRegex }).sort({ name: 1 });
};

// @route   GET /api/pizza/menu
// @desc    Everything the customer-facing UI needs in a single request
router.get('/menu', auth, async (req, res) => {
  try {
    const [bases, sauces, cheeses, veggies, meats, drinks, addons, products, categories] = await Promise.all([
      findByCategory(['base', 'bases', 'crust', 'crusts']),
      findByCategory(['sauce', 'sauces']),
      findByCategory(['cheese', 'cheeses']),
      findByCategory(['veggie', 'veggies', 'vegetable', 'vegetables']),
      findByCategory(['meat', 'meats', 'non-veg', 'nonveg']),
      findByCategory(['drink', 'drinks', 'beverage', 'beverages']),
      findByCategory(['addon', 'addons', 'extra', 'extras']),
      Product.find({ available: true })
        .sort({ name: 1 })
        .populate('categoryId', 'name slug'),
      ProductCategory.find({ active: true }).sort({ sortOrder: 1, name: 1 }),
    ]);
    res.json({
      bases, sauces, cheeses, veggies, meats, drinks, addons, products, categories,
      sizes: getSizes(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/pizza/drinks
// @desc    Get all cold drinks
router.get('/drinks', auth, async (req, res) => {
  try {
    const drinks = await findByCategory(['drink', 'drinks', 'beverage', 'beverages']);
    res.json(drinks);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/pizza/bases
// @desc    Get all pizza bases
router.get('/bases', auth, async (req, res) => {
  try {
    const bases = await findByCategory(['base', 'bases', 'crust', 'crusts']);
    res.json(bases);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/pizza/sauces
// @desc    Get all sauces
router.get('/sauces', auth, async (req, res) => {
  try {
    const sauces = await findByCategory(['sauce', 'sauces']);
    res.json(sauces);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/pizza/cheeses
// @desc    Get all cheeses
router.get('/cheeses', auth, async (req, res) => {
  try {
    const cheeses = await findByCategory(['cheese', 'cheeses']);
    res.json(cheeses);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/pizza/veggies
// @desc    Get all veggies
router.get('/veggies', auth, async (req, res) => {
  try {
    const veggies = await findByCategory(['veggie', 'veggies', 'vegetable', 'vegetables']);
    res.json(veggies);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// @route   GET /api/pizza/meats
// @desc    Get all meats
router.get('/meats', auth, async (req, res) => {
  try {
    const meats = await findByCategory(['meat', 'meats', 'non-veg', 'nonveg']);
    res.json(meats);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
