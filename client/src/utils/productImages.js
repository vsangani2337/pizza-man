import margheritaImg from '../assets/margherita.jpg';
import pepperoniImg from '../assets/pepperoni.png';
import veggieImg from '../assets/veggie.png';
import bbqChickenImg from '../assets/bbq_chicken.png';

// Client asset keys stored on Product documents → bundled images.
const productImages = {
  margherita: margheritaImg,
  pepperoni: pepperoniImg,
  veggie: veggieImg,
  bbq_chicken: bbqChickenImg,
};

/** Resolve a Product/Drink image reference to something renderable, or null. */
export const resolveProductImage = (product) => {
  const value = product?.image;
  if (!value) return null;
  if (productImages[value]) return productImages[value];
  if (value.startsWith('http') || value.startsWith('/')) return value;
  return null;
};

export default productImages;
