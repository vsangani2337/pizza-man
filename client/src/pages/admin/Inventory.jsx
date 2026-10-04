import { useEffect, useState } from 'react';
import { getInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../services/api';
import { toast } from 'react-toastify';
import './Inventory.css';

const categories = ['all', 'base', 'sauce', 'cheese', 'veggie', 'meat'];

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ category: 'base', name: '', quantity: 100, price: 0, image: '🍕' });

  const fetchItems = async () => {
    try {
      const { data } = await getInventory();
      setItems(data);
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);

  const getQtyClass = (qty) => qty < 10 ? 'low' : qty < 20 ? 'warn' : 'ok';

  const openAdd = () => {
    setEditItem(null);
    setForm({ category: 'base', name: '', quantity: 100, price: 0, image: '🍕' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ category: item.category, name: item.name, quantity: item.quantity, price: item.price, image: item.image });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) {
        await updateInventoryItem(editItem._id, form);
        toast.success('Item updated');
      } else {
        await addInventoryItem(form);
        toast.success('Item added');
      }
      setShowModal(false);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving item');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await deleteInventoryItem(id);
      toast.success('Item deleted');
      fetchItems();
    } catch (err) {
      toast.error('Error deleting item');
    }
  };

  if (loading) return <div className="page container" style={{display:'flex',justifyContent:'center',alignItems:'center',fontSize:'48px'}}>🍕</div>;

  return (
    <div className="inventory-page page container" style={{ paddingTop: '100px' }}>
      <div className="inventory-header">
        <h1>📦 Inventory Management</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Item</button>
      </div>

      <div className="inventory-tabs">
        {categories.map(c => (
          <button key={c} className={`inv-tab ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>
            {c.charAt(0).toUpperCase() + c.slice(1)} ({c === 'all' ? items.length : items.filter(i => i.category === c).length})
          </button>
        ))}
      </div>

      <div className="inventory-grid" style={{marginTop: 24}}>
        {filtered.map(item => (
          <div className="inv-card" key={item._id}>
            <div className="inv-card-header">
              <span className="inv-card-icon">{item.image}</span>
              <span className="inv-card-cat">{item.category}</span>
            </div>
            <h3>{item.name}</h3>
            <div className="inv-card-stats">
              <div className="inv-stat">
                <span className="inv-stat-label">Stock</span>
                <span className={`inv-stat-value ${getQtyClass(item.quantity)}`}>{item.quantity}</span>
              </div>
              <div className="inv-stat">
                <span className="inv-stat-label">Price</span>
                <span className="inv-stat-value">₹{item.price}</span>
              </div>
            </div>
            <div className="inv-card-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item._id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>{editItem ? 'Edit Item' : 'Add New Item'}</h2>
            <form onSubmit={handleSubmit}>
              {!editItem && (
                <div className="form-group">
                  <label>Category</label>
                  <select className="form-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="base">Base</option>
                    <option value="sauce">Sauce</option>
                    <option value="cheese">Cheese</option>
                    <option value="veggie">Veggie</option>
                    <option value="meat">Meat</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Name</label>
                <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input className="form-input" type="number" min="0" value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})} required />
              </div>
              <div className="form-group">
                <label>Price (₹)</label>
                <input className="form-input" type="number" min="0" value={form.price} onChange={e => setForm({...form, price: parseInt(e.target.value) || 0})} required />
              </div>
              <div className="form-group">
                <label>Emoji Icon</label>
                <input className="form-input" value={form.image} onChange={e => setForm({...form, image: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">{editItem ? 'Update' : 'Add'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;