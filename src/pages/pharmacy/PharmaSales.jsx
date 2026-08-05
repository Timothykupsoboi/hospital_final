// =============================================================
// FILE: PharmaSales.jsx
// PURPOSE: React component / entry point for the eDoc Hospital
//          frontend. Part of the Vite + React SPA.
// =============================================================
import React, { useState, useEffect } from 'react';
import { ShoppingBag, Search, CreditCard, Banknote, Smartphone, User, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ReceiptModal from '../../components/pharmacy/ReceiptModal';

const PharmaSales = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [receiptModal, setReceiptModal] = useState({ open: false, data: null });
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        try {
            const { data, error } = await supabase
                .from('pharmacy_sale')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            const formatted = (data || []).map(s => ({
                ...s,
                sale_id: s.id || s.sale_id, // ensure compatibility
                phname: s.pharmacist?.phname || s.pharmacist?.docname || null
            }));
            
            setSales(formatted);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getPaymentIcon = (method) => {
        if (method === 'Cash') return <Banknote size={14} color="#10b981" />;
        if (method === 'Card') return <CreditCard size={14} color="#0ea5e9" />;
        if (method === 'M-Pesa') return <Smartphone size={14} color="#8b5cf6" />;
        return null;
    };

    const handleViewReceipt = async (sale) => {
        setPreviewLoading(true);
        try {
            // Fetch items for this sale
            const { data: itemsData, error: itemsError } = await supabase
                .from('pharmacy_sale_item')
                .select('*, medicine:medicine_id(med_name)')
                .eq('sale_id', sale.sale_id);

            if (itemsError) throw itemsError;

            const formattedItems = (itemsData || []).map(item => ({
                name: item.medicine?.med_name || 'Unknown Item',
                qty: item.quantity,
                price: item.unit_price
            }));

            const saleDate = new Date(sale.created_at);

            setReceiptModal({
                open: true,
                data: {
                    receiptNo: sale.receipt_no,
                    items: formattedItems,
                    subtotal: sale.total_amount - (sale.tax_amount || 0),
                    taxAmount: sale.tax_amount || 0,
                    total: sale.total_amount,
                    date: saleDate.toLocaleDateString(),
                    time: saleDate.toLocaleTimeString(),
                    customerName: sale.customer_name,
                    paymentMethod: sale.payment_method,
                    isDraft: false
                }
            });
        } catch (err) {
            console.error("Error fetching receipt items:", err);
            alert("Failed to load receipt details.");
        } finally {
            setPreviewLoading(false);
        }
    };

    const filtered = sales.filter(s => 
        (s.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.payment_method || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.receipt_no || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ padding: '40px 56px', maxWidth: '1600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
                <header style={{ marginBottom: '48px' }}>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ShoppingBag size={32} color="#007bff" /> Sales History
                    </h1>
                    <p style={{ color: '#64748b' }}>Review and manage completed pharmacy transactions.</p>
                </header>

                <div style={{ marginBottom: '24px', position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#64748b' }} />
                    <input 
                        type="text" 
                        placeholder="Search by customer name or payment method..." 
                        style={{ width: '100%', padding: '12px 16px 12px 44px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem', background: 'white' }} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.875rem', fontWeight: '600', color: '#64748b' }}>TRANSACTION ID</th>
                                <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.875rem', fontWeight: '600', color: '#64748b' }}>CUSTOMER / PATIENT</th>
                                <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.875rem', fontWeight: '600', color: '#64748b' }}>PAYMENT</th>
                                <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.875rem', fontWeight: '600', color: '#64748b' }}>DATE & TIME</th>
                                <th style={{ textAlign: 'right', padding: '16px 24px', fontSize: '0.875rem', fontWeight: '600', color: '#64748b' }}>TOTAL AMOUNT</th>
                                <th style={{ textAlign: 'right', padding: '16px 24px', fontSize: '0.875rem', fontWeight: '600', color: '#64748b' }}>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Loading sales history...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>No transactions found.</td></tr>
                            ) : filtered.map(sale => (
                                <tr key={sale.sale_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '16px 24px', fontWeight: '700', color: '#007bff' }}>
                                        <div style={{ fontSize: '0.875rem' }}>#SALE-{String(sale.sale_id).padStart(4, '0')}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{sale.receipt_no || 'N/A'}</div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <User size={14} color="#64748b" />
                                            <span style={{ fontWeight: '600' }}>{sale.customer_name || 'Walk-in Customer'}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}>
                                            {getPaymentIcon(sale.payment_method)}
                                            {(sale.payment_method || 'N/A').toUpperCase()}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px', fontSize: '0.875rem', color: '#64748b' }}>
                                        {new Date(sale.created_at).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '800', color: '#1e293b' }}>
                                        KSh {Number(sale.total_amount).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <button 
                                            onClick={() => handleViewReceipt(sale)}
                                            disabled={previewLoading}
                                            style={{ 
                                                padding: '8px 12px', 
                                                background: '#e7f2ff', 
                                                color: '#007bff', 
                                                border: 'none', 
                                                borderRadius: '8px', 
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: '700'
                                            }}
                                        >
                                            <Eye size={14} /> VIEW
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <ReceiptModal 
                    isOpen={receiptModal.open} 
                    onClose={() => setReceiptModal({ open: false, data: null })} 
                    saleData={receiptModal.data} 
                />
        </div>
    );
};

export default PharmaSales;
