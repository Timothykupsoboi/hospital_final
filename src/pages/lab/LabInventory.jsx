// =============================================================
// FILE: LabInventory.jsx
// PURPOSE: React component / entry point for the eDoc Hospital
//          frontend. Part of the Vite + React SPA.
// =============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { Package, AlertTriangle, Plus, Edit2, Trash2, X, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const emptyForm = { item_name: '', quantity: '', min_stock: '', expiry_date: '', supplier: '' };

export default function LabInventory() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('lab_inventory').select('*').order('item_name');
            if (error) throw error;
            setItems(data || []);
        } catch (e) { setItems([]); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const openAdd = () => { setEditing(null); setForm(emptyForm); setModal(true); };
    const openEdit = (item) => { setEditing(item.id); setForm({ ...item }); setModal(true); };

    const handleSave = async () => {
        if (!form.item_name || !form.quantity) return showToast('Item name and quantity are required', 'error');
        setSaving(true);
        try {
            if (editing) {
                const { error } = await supabase.from('lab_inventory').update({
                    item_name: form.item_name,
                    quantity: form.quantity,
                    reorder_level: form.min_stock || 10
                }).eq('id', editing);
                if (error) throw error;
                showToast('Item updated ✓');
            } else {
                const { error } = await supabase.from('lab_inventory').insert({
                    item_name: form.item_name,
                    quantity: form.quantity,
                    reorder_level: form.min_stock || 10
                });
                if (error) throw error;
                showToast('Item added ✓');
            }
            setModal(false);
            fetchItems();
        } catch (err) {
            console.error(err);
            showToast('Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Remove "${name}" from inventory?`)) return;
        try {
            const { error } = await supabase.from('lab_inventory').delete().eq('id', id);
            if (error) throw error;
            showToast('Item removed');
            fetchItems();
        } catch (e) {
            showToast('Failed to remove item', 'error');
        }
    };

    const filtered = items.filter(i => !search || i.item_name?.toLowerCase().includes(search.toLowerCase()) || i.supplier?.toLowerCase().includes(search.toLowerCase()));
    const lowStock = items.filter(i => Number(i.quantity) <= Number(i.min_stock || 10));
    const expired = items.filter(i => i.expiry_date && new Date(i.expiry_date) < new Date());

    const getStockStatus = (item) => {
        if (new Date(item.expiry_date) < new Date()) return { label: 'Expired', color: '#ef4444', bg: '#fef2f2' };
        if (Number(item.quantity) <= Number(item.min_stock || 10)) return { label: 'Low Stock', color: '#f59e0b', bg: '#fffbeb' };
        return { label: 'OK', color: '#10b981', bg: '#ecfdf5' };
    };

    return (
        <div style={{ padding: '40px 56px', maxWidth: '1600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
                {toast && <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: 'white', padding: '12px 24px', borderRadius: 12, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>{toast.msg}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Package size={28} color="#f59e0b" /> Inventory & Supplies
                        </h1>
                        <p style={{ color: '#64748b', marginTop: 4 }}>Manage reagents, kits, and lab consumables.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={fetchItems} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b' }}><RefreshCw size={16} /></button>
                        <button onClick={openAdd} style={{ padding: '10px 20px', borderRadius: 10, background: '#f59e0b', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Plus size={16} /> Add Item
                        </button>
                    </div>
                </div>

                {/* Alert Banners */}
                {lowStock.length > 0 && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AlertTriangle size={18} color="#f59e0b" />
                        <div>
                            <span style={{ fontWeight: 700, color: '#b45309' }}>{lowStock.length} item{lowStock.length > 1 ? 's' : ''} below minimum stock: </span>
                            <span style={{ color: '#b45309', fontSize: '0.875rem' }}>{lowStock.map(i => i.item_name).join(', ')}</span>
                        </div>
                    </div>
                )}
                {expired.length > 0 && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AlertTriangle size={18} color="#ef4444" />
                        <div>
                            <span style={{ fontWeight: 700, color: '#dc2626' }}>{expired.length} item{expired.length > 1 ? 's' : ''} EXPIRED: </span>
                            <span style={{ color: '#dc2626', fontSize: '0.875rem' }}>{expired.map(i => i.item_name).join(', ')}</span>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                    {[
                        { label: 'Total Items', value: items.length, color: '#3b82f6', bg: '#eff6ff' },
                        { label: 'Low Stock', value: lowStock.length, color: '#f59e0b', bg: '#fffbeb' },
                        { label: 'Expired', value: expired.length, color: '#ef4444', bg: '#fef2f2' },
                        { label: 'In Stock', value: items.filter(i => Number(i.quantity) > Number(i.min_stock || 10) && new Date(i.expiry_date) > new Date()).length, color: '#10b981', bg: '#ecfdf5' },
                    ].map((s, i) => (
                        <div key={i} style={{ background: 'white', padding: '18px 20px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', marginBottom: 20 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by item name or supplier..." style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                </div>

                {/* Table */}
                <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                {['Item Name', 'Quantity', 'Min Stock', 'Expiry Date', 'Supplier', 'Status', 'Actions'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '14px 20px', fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 64, color: '#94a3b8' }}>Loading inventory...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 64 }}>
                                    <Package size={40} color="#e2e8f0" style={{ marginBottom: 12 }} />
                                    <p style={{ color: '#94a3b8' }}>No inventory items. Add your first item to get started.</p>
                                </td></tr>
                            ) : filtered.map((item, i) => {
                                const status = getStockStatus(item);
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc', transition: '0.15s' }}
                                        onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                                        onMouseOut={e => e.currentTarget.style.background = 'white'}>
                                        <td style={{ padding: '16px 20px', fontWeight: 700, color: '#1e293b' }}>{item.item_name}</td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: Number(item.quantity) <= Number(item.min_stock || 10) ? '#ef4444' : '#1e293b' }}>
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px', color: '#64748b' }}>{item.min_stock || 10}</td>
                                        <td style={{ padding: '16px 20px', fontSize: '0.875rem', color: item.expiry_date && new Date(item.expiry_date) < new Date() ? '#ef4444' : '#64748b' }}>
                                            {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '—'}
                                        </td>
                                        <td style={{ padding: '16px 20px', fontSize: '0.875rem', color: '#475569' }}>{item.supplier || '—'}</td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{ background: status.bg, color: status.color, padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button onClick={() => openEdit(item)} style={{ padding: '6px 12px', borderRadius: 8, background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', cursor: 'pointer' }}><Edit2 size={13} /></button>
                                                <button onClick={() => handleDelete(item.id, item.item_name)} style={{ padding: '6px 12px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', cursor: 'pointer' }}><Trash2 size={13} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

            {modal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: 'white', borderRadius: 20, width: 480, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
                        <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{editing ? 'Edit Item' : 'Add Inventory Item'}</h2>
                            <button onClick={() => setModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                { label: 'Item Name *', key: 'item_name', type: 'text', placeholder: 'e.g. EDTA Tubes (3mL)' },
                                { label: 'Quantity *', key: 'quantity', type: 'number', placeholder: '100' },
                                { label: 'Minimum Stock Threshold', key: 'min_stock', type: 'number', placeholder: '20' },
                                { label: 'Expiry Date', key: 'expiry_date', type: 'date', placeholder: '' },
                                { label: 'Supplier', key: 'supplier', type: 'text', placeholder: 'Supplier name or company' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{f.label}</label>
                                    <input type={f.type} value={form[f.key] || ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '16px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
                            <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 10, background: '#f59e0b', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                                {saving ? 'Saving...' : editing ? 'Update Item' : 'Add Item'}
                            </button>
                            <button onClick={() => setModal(false)} style={{ padding: '12px 20px', borderRadius: 10, background: '#f1f5f9', color: '#64748b', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
