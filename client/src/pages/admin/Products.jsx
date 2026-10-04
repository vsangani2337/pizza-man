import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMenu,
  getProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../services/api';
import { ErrorState, EmptyState } from '../../components/StateViews';
import { SkeletonLine } from '../../components/ui/Skeletons';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { formatMoney } from '../../utils/normalizeOrder';
import { resolveProductImage } from '../../utils/productImages';
import { toast } from 'react-toastify';
import './Products.css';

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  image: '',
  categoryId: '',
  available: true,
  base: '',
  sauce: '',
  cheese: '',
  veggies: [],
};

const Products = () => {
  const [tab, setTab] = useState('pizzas');

  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const [categories, setCategories] = useState([]);
  const [menuOptions, setMenuOptions] = useState({ bases: [], sauces: [], cheeses: [], veggies: [] });

  const [productModal, setProductModal] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = { page, limit: 8 };
      if (search) params.search = search;
      const { data } = await getProductsAdmin(params);
      setProducts(data.products);
      setMeta({ total: data.total, page: data.page, pages: data.pages });
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load products.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await getCategories();
      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch {
      setCategories([]);
    }
  }, []);

  const fetchMenuOptions = useCallback(async () => {
    try {
      const { data } = await getMenu();
      setMenuOptions({
        bases: (data.bases || []).map((i) => i.name),
        sauces: (data.sauces || []).map((i) => i.name),
        cheeses: (data.cheeses || []).map((i) => i.name),
        veggies: (data.veggies || []).map((i) => i.name),
      });
    } catch {
      /* datalists are optional */
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchProducts, search, attempt]);

  useEffect(() => {
    fetchCategories();
    fetchMenuOptions();
  }, [fetchCategories, fetchMenuOptions]);

  const openCreate = () => {
    setFormError('');
    setProductModal({ mode: 'create', form: { ...EMPTY_FORM } });
  };

  const openEdit = (product) => {
    setFormError('');
    setProductModal({
      mode: 'edit',
      id: product._id,
      form: {
        name: product.name,
        description: product.description || '',
        price: product.price ?? '',
        image: product.image || '',
        categoryId: product.categoryId?._id || product.categoryId || '',
        available: product.available !== false,
        base: product.pizza?.base || '',
        sauce: product.pizza?.sauce || '',
        cheese: product.pizza?.cheese || '',
        veggies: product.pizza?.veggies || [],
      },
    });
  };

  const toggleVeggie = (name) => {
    setProductModal((m) => {
      const veggies = m.form.veggies.includes(name)
        ? m.form.veggies.filter((v) => v !== name)
        : [...m.form.veggies, name];
      return { ...m, form: { ...m.form, veggies } };
    });
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    const form = productModal.form;
    if (!form.name.trim()) return setFormError('Name is required.');
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 1) return setFormError('Price must be at least ₹1.');
    if (!form.base.trim() || !form.sauce.trim() || !form.cheese.trim()) {
      return setFormError('Base, sauce and cheese are required for the composition.');
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      image: form.image.trim(),
      categoryId: form.categoryId || null,
      available: Boolean(form.available),
      pizza: {
        base: form.base.trim(),
        sauce: form.sauce.trim(),
        cheese: form.cheese.trim(),
        veggies: form.veggies,
      },
    };

    setBusy(true);
    setFormError('');
    try {
      if (productModal.mode === 'create') {
        await createProduct(payload);
        toast.success('Pizza created.');
      } else {
        await updateProduct(productModal.id, payload);
        toast.success('Pizza updated.');
      }
      setProductModal(null);
      fetchProducts();
      fetchCategories();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = (product) => {
    setConfirm({
      title: 'Delete pizza',
      message: `Delete "${product.name}"? Past orders keep their price snapshot.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteProduct(product._id);
          toast.success('Pizza deleted.');
          setConfirm(null);
          fetchProducts();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Delete failed.');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    const name = categoryModal.form.name.trim();
    if (!name) return setFormError('Category name is required.');
    setBusy(true);
    setFormError('');
    try {
      if (categoryModal.mode === 'create') {
        await createCategory({ name });
        toast.success('Category created.');
      } else {
        await updateCategory(categoryModal.id, { name });
        toast.success('Category renamed.');
      }
      setCategoryModal(null);
      fetchCategories();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const removeCategory = (category) => {
    setConfirm({
      title: 'Delete category',
      message: `Delete "${category.name}"? Products using it become uncategorized.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteCategory(category._id);
          toast.success('Category deleted.');
          setConfirm(null);
          fetchCategories();
          fetchProducts();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Delete failed.');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const startCategory = () => {
    setFormError('');
    setCategoryModal({ mode: 'create', form: { name: '' } });
  };

  return (
    <div className="admin-page admin-products animate-fade">
      <header className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">🍕 Menu catalogue</span>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">
            Signature pizzas with server-side prices. Drinks &amp; toppings are inventory items — manage them on the
            Inventory page.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn-secondary" to="/admin/inventory">Open Inventory →</Link>
          <button type="button" className="btn btn-primary" onClick={openCreate}>+ New Pizza</button>
        </div>
      </header>

      <div className="segmented" role="group" aria-label="Product sections">
        <button
          type="button"
          className={`segment ${tab === 'pizzas' ? 'is-active' : ''}`}
          aria-pressed={tab === 'pizzas'}
          onClick={() => setTab('pizzas')}
        >
          Pizzas
        </button>
        <button
          type="button"
          className={`segment ${tab === 'categories' ? 'is-active' : ''}`}
          aria-pressed={tab === 'categories'}
          onClick={() => setTab('categories')}
        >
          Categories
          <span className="segment-count">{categories.length}</span>
        </button>
      </div>

      {tab === 'pizzas' && (
        <section className="admin-panel" aria-label="Pizzas">
          <h2 className="sr-only-field">Pizzas</h2>

          <div className="card toolbar-card">
            <div className="toolbar" role="search" aria-label="Search pizzas">
              <label className="sr-only-field" htmlFor="product-search">Search pizzas</label>
              <div className="field-with-icon">
                <span className="field-icon" aria-hidden="true">🔍</span>
                <input
                  id="product-search"
                  type="search"
                  placeholder="Search pizzas…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <span className="toolbar-spacer" />
              <span className="toolbar-note">{meta.total} pizza{meta.total === 1 ? '' : 's'}</span>
            </div>
          </div>

          {loading ? (
            <div className="data-table-wrap" role="status" aria-label="Loading pizzas">
              <div className="sk-table" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div className="sk-table-row" key={index}>
                    <SkeletonLine width="34%" height={14} />
                    <SkeletonLine width="16%" height={14} />
                    <SkeletonLine width="12%" height={14} />
                    <SkeletonLine width="14%" height={14} />
                    <SkeletonLine width="18%" height={14} />
                  </div>
                ))}
              </div>
            </div>
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={() => setAttempt((a) => a + 1)} />
          ) : products.length === 0 ? (
            <EmptyState icon="🍕" title="No pizzas yet" description="Create your first pizza to appear on the menu.">
              <button type="button" className="btn btn-primary" onClick={openCreate}>+ New Pizza</button>
            </EmptyState>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <caption className="sr-only-field">Pizza products</caption>
                <thead>
                  <tr>
                    <th scope="col">Pizza</th>
                    <th scope="col">Category</th>
                    <th scope="col">Price</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product._id}>
                      <td data-label="Pizza" className="col-item">
                        <div className="product-cell">
                          {resolveProductImage(product) ? (
                            <img src={resolveProductImage(product)} alt="" className="product-thumb" loading="lazy" />
                          ) : (
                            <span className="product-thumb product-thumb-fallback" aria-hidden="true">🍕</span>
                          )}
                          <div className="product-text">
                            <strong>{product.name}</strong>
                            <small className="form-hint">{(product.description || '').slice(0, 70)}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Category">
                        {product.categoryId?.name ? (
                          <span className="badge badge-neutral">{product.categoryId.name}</span>
                        ) : (
                          <span className="chip chip-off">uncategorized</span>
                        )}
                      </td>
                      <td data-label="Price">
                        <strong className="price">{formatMoney(product.price)}</strong>
                      </td>
                      <td data-label="Status">
                        <span className={`chip ${product.available !== false ? 'chip-ok' : 'chip-off'}`}>
                          {product.available !== false ? 'Available' : 'Hidden'}
                        </span>
                      </td>
                      <td data-label="Actions" className="col-actions">
                        <div className="row-actions">
                          <button type="button" onClick={() => openEdit(product)}>Edit</button>
                          <button type="button" onClick={() => removeProduct(product)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pagination">
            <button type="button" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)}>← Previous</button>
            <span className="page-info">Page {meta.page} of {meta.pages} · {meta.total} pizza{meta.total === 1 ? '' : 's'}</span>
            <button type="button" disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </section>
      )}

      {tab === 'categories' && (
        <section className="admin-panel" aria-label="Categories">
          <h2 className="sr-only-field">Categories</h2>

          <div className="card toolbar-card">
            <div className="toolbar">
              <span className="toolbar-note">Categories group pizzas on the menu (e.g. Signature Pizzas).</span>
              <span className="toolbar-spacer" />
              <button type="button" className="btn btn-primary" onClick={startCategory}>+ New Category</button>
            </div>
          </div>

          {categories.length === 0 ? (
            <EmptyState icon="🏷️" title="No categories yet" description="Create one to group your pizzas.">
              <button type="button" className="btn btn-primary" onClick={startCategory}>+ New Category</button>
            </EmptyState>
          ) : (
            <div className="category-list animate-stagger">
              {categories.map((category) => (
                <div className="category-card" key={category._id}>
                  <div className="category-card-text">
                    <span className="category-icon" aria-hidden="true">🏷️</span>
                    <div>
                      <strong>{category.name}</strong>
                      {category.slug && <p className="form-hint">/{category.slug}</p>}
                    </div>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      onClick={() => { setFormError(''); setCategoryModal({ mode: 'edit', id: category._id, form: { name: category.name } }); }}
                    >
                      Rename
                    </button>
                    <button type="button" onClick={() => removeCategory(category)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <Modal
        open={Boolean(productModal)}
        title={productModal?.mode === 'edit' ? 'Edit pizza' : 'New pizza'}
        onClose={() => setProductModal(null)}
        width="640px"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setProductModal(null)} disabled={busy}>Cancel</button>
            <button
              type="submit"
              form="product-form"
              className={`btn btn-primary ${busy ? 'is-loading' : ''}`}
              disabled={busy}
            >
              {busy ? 'Saving…' : productModal?.mode === 'edit' ? 'Save changes' : 'Create pizza'}
            </button>
          </>
        }
      >
        {productModal && (
          <form id="product-form" className="form-grid" onSubmit={saveProduct}>
            <div className="form-field">
              <label htmlFor="product-name">Name *</label>
              <input
                id="product-name"
                value={productModal.form.name}
                onChange={(e) => setProductModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))}
                required
              />
              <span className="form-hint">2–80 characters, unique across the menu.</span>
            </div>
            <div className="form-field">
              <label htmlFor="product-price">Price (₹) *</label>
              <input
                id="product-price"
                type="number"
                min="1"
                step="1"
                value={productModal.form.price}
                onChange={(e) => setProductModal((m) => ({ ...m, form: { ...m.form, price: e.target.value } }))}
                required
              />
              <span className="form-hint">Whole rupees between ₹1 and ₹100,000.</span>
            </div>
            <div className="form-field">
              <label htmlFor="product-category">Category</label>
              <select
                id="product-category"
                value={productModal.form.categoryId}
                onChange={(e) => setProductModal((m) => ({ ...m, form: { ...m.form, categoryId: e.target.value } }))}
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>{category.name}</option>
                ))}
              </select>
              <span className="form-hint">Groups pizzas on the storefront menu.</span>
            </div>
            <div className="form-field">
              <label htmlFor="product-image">Image (asset key or URL)</label>
              <input
                id="product-image"
                placeholder="margherita or https://…"
                value={productModal.form.image}
                onChange={(e) => setProductModal((m) => ({ ...m, form: { ...m.form, image: e.target.value } }))}
              />
              <span className="form-hint">Leave empty to show the pizza placeholder.</span>
            </div>
            <div className="form-field full-span">
              <label htmlFor="product-description">Description</label>
              <textarea
                id="product-description"
                rows="2"
                maxLength={300}
                value={productModal.form.description}
                onChange={(e) => setProductModal((m) => ({ ...m, form: { ...m.form, description: e.target.value } }))}
              />
              <span className="form-hint">Up to 300 characters, shown under the pizza on the menu.</span>
            </div>

            <fieldset className="composition-fieldset">
              <legend>Composition (used for stock checks)</legend>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="product-base">Base *</label>
                  <input
                    id="product-base"
                    list="opt-bases"
                    value={productModal.form.base}
                    onChange={(e) => setProductModal((m) => ({ ...m, form: { ...m.form, base: e.target.value } }))}
                    required
                  />
                  <span className="form-hint">Pick an existing base or type a new one.</span>
                </div>
                <div className="form-field">
                  <label htmlFor="product-sauce">Sauce *</label>
                  <input
                    id="product-sauce"
                    list="opt-sauces"
                    value={productModal.form.sauce}
                    onChange={(e) => setProductModal((m) => ({ ...m, form: { ...m.form, sauce: e.target.value } }))}
                    required
                  />
                  <span className="form-hint">Pick an existing sauce or type a new one.</span>
                </div>
                <div className="form-field">
                  <label htmlFor="product-cheese">Cheese *</label>
                  <input
                    id="product-cheese"
                    list="opt-cheeses"
                    value={productModal.form.cheese}
                    onChange={(e) => setProductModal((m) => ({ ...m, form: { ...m.form, cheese: e.target.value } }))}
                    required
                  />
                  <span className="form-hint">Pick an existing cheese or type a new one.</span>
                </div>
              </div>
              <div className="veggie-picker">
                <span className="form-hint">Toppings included:</span>
                <div className="veggie-options">
                  {menuOptions.veggies.map((veggie) => (
                    <label key={veggie} className={`veggie-option ${productModal.form.veggies.includes(veggie) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={productModal.form.veggies.includes(veggie)}
                        onChange={() => toggleVeggie(veggie)}
                      />
                      {veggie}
                    </label>
                  ))}
                  {menuOptions.veggies.length === 0 && <span className="form-hint">No veggie inventory yet.</span>}
                </div>
              </div>
            </fieldset>

            <datalist id="opt-bases">{menuOptions.bases.map((v) => <option key={v} value={v} />)}</datalist>
            <datalist id="opt-sauces">{menuOptions.sauces.map((v) => <option key={v} value={v} />)}</datalist>
            <datalist id="opt-cheeses">{menuOptions.cheeses.map((v) => <option key={v} value={v} />)}</datalist>

            <label className="switch-row full-span">
              <span>Visible on menu</span>
              <input
                type="checkbox"
                checked={productModal.form.available}
                onChange={(e) => setProductModal((m) => ({ ...m, form: { ...m.form, available: e.target.checked } }))}
              />
            </label>
            {formError && <p className="form-error-text full-span" role="alert">{formError}</p>}
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(categoryModal)}
        title={categoryModal?.mode === 'edit' ? 'Rename category' : 'New category'}
        onClose={() => setCategoryModal(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCategoryModal(null)} disabled={busy}>Cancel</button>
            <button
              type="submit"
              form="category-form"
              className={`btn btn-primary ${busy ? 'is-loading' : ''}`}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {categoryModal && (
          <form id="category-form" onSubmit={saveCategory}>
            <div className="form-field">
              <label htmlFor="category-name">Category name *</label>
              <input
                id="category-name"
                value={categoryModal.form.name}
                onChange={(e) => setCategoryModal((m) => ({ ...m, form: { name: e.target.value } }))}
                autoFocus
                required
              />
              <span className="form-hint">2–60 characters. Duplicates are rejected.</span>
            </div>
            {formError && <p className="form-error-text" role="alert">{formError}</p>}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
      />
    </div>
  );
};

export default Products;
