import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

type StoreOption = { _id: string; name: string; slug: string };

type FoodCategory = {
  _id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  store: StoreOption | string;
};

type FoodItem = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  sortOrder: number;
  isAvailable: boolean;
  store: StoreOption | string;
  category: { _id: string; name: string } | string;
};

type FoodOrderRow = {
  _id: string;
  totalPoints: number;
  status: string;
  notes?: string;
  items: { name: string; quantity: number; lineTotal: number }[];
  user?: { name?: string; phone?: string; email?: string };
  store?: StoreOption;
  booking?: { startTime?: string; endTime?: string; date?: string };
  createdAt: string;
  notifyResult?: { skipped?: boolean; success?: boolean; reason?: string };
};

function errMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || '操作失敗';
}

function getImageUrl(imagePath?: string) {
  if (!imagePath) return '';
  if (imagePath.startsWith('http') || imagePath.startsWith('blob:')) return imagePath;
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  const base = apiUrl.replace(/\/api\/?$/, '');
  const clean = imagePath.replace(/^\//, '').replace(/^uploads\//, '');
  return `${base}/uploads/${clean}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待處理',
  preparing: '製作中',
  ready: '可取餐',
  completed: '已完成',
  cancelled: '已取消',
};

const FoodOrderManagement: React.FC = () => {
  const [tab, setTab] = useState<'categories' | 'items' | 'orders' | 'notify'>('items');
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [filterStore, setFilterStore] = useState('');
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [orders, setOrders] = useState<FoodOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [catEditor, setCatEditor] = useState<FoodCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', sortOrder: '0', isActive: true });
  const [catOpen, setCatOpen] = useState(false);

  const [itemEditor, setItemEditor] = useState<FoodItem | null>(null);
  const [itemForm, setItemForm] = useState({
    category: '',
    name: '',
    description: '',
    price: '',
    sortOrder: '0',
    isAvailable: true,
  });
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [itemOpen, setItemOpen] = useState(false);

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyPhones, setNotifyPhones] = useState('');

  const loadStores = useCallback(async () => {
    const res = await axios.get('/stores/admin/all');
    const list: StoreOption[] = res.data.stores || res.data || [];
    setStores(list);
    if (!filterStore && list.length === 1) setFilterStore(list[0]._id);
  }, [filterStore]);

  const loadCategories = useCallback(async () => {
    if (!filterStore) {
      setCategories([]);
      return;
    }
    const res = await axios.get('/food/admin/categories', { params: { storeId: filterStore } });
    setCategories(res.data.categories || []);
  }, [filterStore]);

  const loadItems = useCallback(async () => {
    if (!filterStore) {
      setItems([]);
      return;
    }
    const res = await axios.get('/food/admin/items', { params: { storeId: filterStore } });
    setItems(res.data.items || []);
  }, [filterStore]);

  const loadOrders = useCallback(async () => {
    if (!filterStore) {
      setOrders([]);
      return;
    }
    const res = await axios.get('/food/admin/orders', { params: { storeId: filterStore } });
    setOrders(res.data.orders || []);
  }, [filterStore]);

  const loadNotify = useCallback(async () => {
    if (!filterStore) return;
    const res = await axios.get(`/food/admin/notify-settings/${filterStore}`);
    const cfg = res.data.foodOrderNotify || {};
    setNotifyEnabled(Boolean(cfg.enabled));
    setNotifyPhones((cfg.notifyPhones || []).join(', '));
  }, [filterStore]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadStores();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadStores]);

  useEffect(() => {
    if (!filterStore) return;
    (async () => {
      try {
        await Promise.all([loadCategories(), loadItems(), loadOrders(), loadNotify()]);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [filterStore, loadCategories, loadItems, loadOrders, loadNotify]);

  const storeCategories = useMemo(
    () => categories.filter((c) => String((c.store as StoreOption)?._id || c.store) === filterStore),
    [categories, filterStore]
  );

  const openNewCategory = () => {
    setCatEditor(null);
    setCatForm({ name: '', description: '', sortOrder: '0', isActive: true });
    setCatOpen(true);
  };

  const openEditCategory = (c: FoodCategory) => {
    setCatEditor(c);
    setCatForm({
      name: c.name,
      description: c.description || '',
      sortOrder: String(c.sortOrder ?? 0),
      isActive: c.isActive,
    });
    setCatOpen(true);
  };

  const saveCategory = async () => {
    if (!filterStore) return alert('請先選擇店鋪');
    if (!catForm.name.trim()) return alert('請輸入類別名稱');
    setBusy(true);
    try {
      if (catEditor) {
        await axios.put(`/food/admin/categories/${catEditor._id}`, {
          ...catForm,
          sortOrder: Number(catForm.sortOrder) || 0,
        });
      } else {
        await axios.post('/food/admin/categories', {
          store: filterStore,
          ...catForm,
          sortOrder: Number(catForm.sortOrder) || 0,
        });
      }
      setCatOpen(false);
      await loadCategories();
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async (c: FoodCategory) => {
    if (!window.confirm(`刪除類別「${c.name}」？`)) return;
    try {
      await axios.delete(`/food/admin/categories/${c._id}`);
      await loadCategories();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const openNewItem = () => {
    setItemEditor(null);
    setItemForm({
      category: storeCategories[0]?._id || '',
      name: '',
      description: '',
      price: '',
      sortOrder: '0',
      isAvailable: true,
    });
    setItemImage(null);
    setItemOpen(true);
  };

  const openEditItem = (item: FoodItem) => {
    setItemEditor(item);
    setItemForm({
      category: typeof item.category === 'string' ? item.category : item.category._id,
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      sortOrder: String(item.sortOrder ?? 0),
      isAvailable: item.isAvailable,
    });
    setItemImage(null);
    setItemOpen(true);
  };

  const saveItem = async () => {
    if (!filterStore) return alert('請先選擇店鋪');
    if (!itemForm.category) return alert('請選擇類別');
    if (!itemForm.name.trim()) return alert('請輸入餐點名稱');
    if (itemForm.price === '' || Number(itemForm.price) < 0) return alert('請輸入有效價錢');

    const fd = new FormData();
    fd.append('store', filterStore);
    fd.append('category', itemForm.category);
    fd.append('name', itemForm.name.trim());
    fd.append('description', itemForm.description);
    fd.append('price', String(Number(itemForm.price)));
    fd.append('sortOrder', String(Number(itemForm.sortOrder) || 0));
    fd.append('isAvailable', String(itemForm.isAvailable));
    if (itemImage) fd.append('image', itemImage);

    setBusy(true);
    try {
      if (itemEditor) {
        await axios.put(`/food/admin/items/${itemEditor._id}`, fd);
      } else {
        await axios.post('/food/admin/items', fd);
      }
      setItemOpen(false);
      await loadItems();
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (item: FoodItem) => {
    if (!window.confirm(`刪除餐點「${item.name}」？`)) return;
    try {
      await axios.delete(`/food/admin/items/${item._id}`);
      await loadItems();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await axios.patch(`/food/admin/orders/${orderId}/status`, { status });
      await loadOrders();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const saveNotify = async () => {
    if (!filterStore) return;
    setBusy(true);
    try {
      await axios.put(`/food/admin/notify-settings/${filterStore}`, {
        enabled: notifyEnabled,
        notifyPhones,
      });
      alert('通知設定已儲存');
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">載入中...</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">訂餐系統</h2>
          <p className="text-sm text-gray-500">按店鋪管理類別、餐點、訂單與廚房通知電話</p>
        </div>
        <select
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]"
        >
          <option value="">選擇店鋪</option>
          {stores.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
      </div>

      {!filterStore ? (
        <div className="bg-amber-50 text-amber-800 rounded-lg p-4 text-sm">請先選擇店鋪</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
            {([
              ['items', '餐點'],
              ['categories', '類別'],
              ['orders', '訂單'],
              ['notify', '通知設定'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  tab === id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'categories' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={openNewCategory}
                className="inline-flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm"
              >
                <PlusIcon className="w-4 h-4" /> 新增類別
              </button>
              <div className="bg-white rounded-lg border border-gray-200 divide-y">
                {storeCategories.length === 0 && (
                  <div className="p-4 text-sm text-gray-500">尚未建立類別</div>
                )}
                {storeCategories.map((c) => (
                  <div key={c._id} className="flex items-center justify-between gap-3 p-3">
                    <div>
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">
                        排序 {c.sortOrder} · {c.isActive ? '啟用' : '停用'}
                        {c.description ? ` · ${c.description}` : ''}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEditCategory(c)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => deleteCategory(c)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'items' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={openNewItem}
                className="inline-flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm"
              >
                <PlusIcon className="w-4 h-4" /> 新增餐點
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.length === 0 && (
                  <div className="col-span-full p-4 text-sm text-gray-500 bg-white rounded-lg border">尚未建立餐點</div>
                )}
                {items.map((item) => (
                  <div key={item._id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="aspect-square bg-gray-100 flex items-center justify-center">
                      {item.image ? (
                        <img src={getImageUrl(item.image)} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <PhotoIcon className="w-12 h-12 text-gray-300" />
                      )}
                    </div>
                    <div className="p-3 space-y-1">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-primary-600 font-semibold">{item.price} 積分</div>
                      <div className="text-xs text-gray-500">
                        {typeof item.category === 'object' ? item.category.name : ''}
                        {' · '}
                        {item.isAvailable ? '上架' : '下架'}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => openEditItem(item)} className="text-sm text-gray-600 hover:text-primary-600">編輯</button>
                        <button type="button" onClick={() => deleteItem(item)} className="text-sm text-red-600">刪除</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="bg-white rounded-lg border border-gray-200 divide-y">
              {orders.length === 0 && (
                <div className="p-4 text-sm text-gray-500">暫無訂單</div>
              )}
              {orders.map((o) => (
                <div key={o._id} className="p-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900">
                        {o.user?.name || '用戶'} {o.user?.phone ? `· ${o.user.phone}` : ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        {o.booking?.startTime}-{o.booking?.endTime}
                        {' · '}
                        {new Date(o.createdAt).toLocaleString('zh-HK')}
                        {' · '}
                        #{String(o._id).slice(-6)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-primary-600">{o.totalPoints} 積分</div>
                      <div className="text-xs text-gray-500">{STATUS_LABEL[o.status] || o.status}</div>
                    </div>
                  </div>
                  <ul className="text-sm text-gray-700">
                    {o.items.map((it, idx) => (
                      <li key={idx}>{it.name} x{it.quantity}</li>
                    ))}
                  </ul>
                  {o.notes && <div className="text-xs text-amber-700">備註：{o.notes}</div>}
                  <div className="flex flex-wrap gap-2">
                    {(['pending', 'preparing', 'ready', 'completed', 'cancelled'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={o.status === s}
                        onClick={() => updateOrderStatus(o._id, s)}
                        className={`px-2 py-1 text-xs rounded border ${
                          o.status === s
                            ? 'bg-primary-50 border-primary-300 text-primary-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'notify' && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4 max-w-lg">
              <p className="text-sm text-gray-600">
                用戶完成訂餐並扣除積分後，系統會用 WhatsApp（OpenWA）將訂單內容發送到下列電話號碼。
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyEnabled}
                  onChange={(e) => setNotifyEnabled(e.target.checked)}
                />
                啟用訂餐通知
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">通知電話（逗號分隔）</label>
                <input
                  type="text"
                  value={notifyPhones}
                  onChange={(e) => setNotifyPhones(e.target.value)}
                  placeholder="例如 85291234567, 85298765432"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={saveNotify}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                儲存設定
              </button>
            </div>
          )}
        </>
      )}

      {catOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-bold text-lg">{catEditor ? '編輯類別' : '新增類別'}</h3>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="類別名稱"
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="描述（選填）"
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              type="number"
              placeholder="排序"
              value={catForm.sortOrder}
              onChange={(e) => setCatForm({ ...catForm, sortOrder: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={catForm.isActive}
                onChange={(e) => setCatForm({ ...catForm, isActive: e.target.checked })}
              />
              啟用
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCatOpen(false)} className="px-3 py-2 text-sm text-gray-600">取消</button>
              <button type="button" disabled={busy} onClick={saveCategory} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">儲存</button>
            </div>
          </div>
        </div>
      )}

      {itemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">{itemEditor ? '編輯餐點' : '新增餐點'}</h3>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={itemForm.category}
              onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
            >
              <option value="">選擇類別</option>
              {storeCategories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="餐點名稱"
              value={itemForm.name}
              onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
            />
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="描述（選填）"
              rows={2}
              value={itemForm.description}
              onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              type="number"
              min={0}
              step={1}
              placeholder="積分價錢"
              value={itemForm.price}
              onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              type="number"
              placeholder="排序"
              value={itemForm.sortOrder}
              onChange={(e) => setItemForm({ ...itemForm, sortOrder: e.target.value })}
            />
            <div>
              <label className="block text-sm text-gray-700 mb-1">圖片</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setItemImage(e.target.files?.[0] || null)}
                className="text-sm"
              />
              {itemEditor?.image && !itemImage && (
                <img src={getImageUrl(itemEditor.image)} alt="" className="mt-2 w-24 h-24 object-cover rounded" />
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={itemForm.isAvailable}
                onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
              />
              上架
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setItemOpen(false)} className="px-3 py-2 text-sm text-gray-600">取消</button>
              <button type="button" disabled={busy} onClick={saveItem} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FoodOrderManagement;
