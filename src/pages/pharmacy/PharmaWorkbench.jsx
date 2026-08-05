// =============================================================
// FILE: PharmaWorkbench.jsx
// PURPOSE: React component / entry point for the eDoc Hospital
//          frontend. Part of the Vite + React SPA.
// =============================================================
import React, { useState, useEffect } from 'react';
import NotificationCenter from '../../components/NotificationCenter';
import EntityDetailModal from '../../components/pharmacy/EntityDetailModal';
import ReceiptModal from '../../components/pharmacy/ReceiptModal';
import { 
    ShoppingCart, User, Search, Plus, Minus, Trash2, 
    Eye, QrCode
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../components/NotificationContext';
import { supabase } from '../../lib/supabase';

const PharmaWorkbench = () => {
    const { showNotification } = useNotification();
    const { profile } = useAuth();
    const [prescriptions, setPrescriptions] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [mpesaPhone, setMpesaPhone] = useState('');
    const [pendingReceiptNo, setPendingReceiptNo] = useState('');
    const [stkLoading, setStkLoading] = useState(false);

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(null);
    const [selectedPresc, setSelectedPresc] = useState(null);
    
    // Advanced states
    const [intelModal, setIntelModal] = useState({ open: false, data: null });
    const [receiptModal, setReceiptModal] = useState({ open: false, data: null });
    const [barcodeBuffer, setBarcodeBuffer] = useState("");
    const [lastCharTime, setLastCharTime] = useState(0);
    const [queueSearch, setQueueSearch] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const now = Date.now();
            if (now - lastCharTime > 50) setBarcodeBuffer(e.key);
            else if (e.key === 'Enter') {
                handleBarcode(barcodeBuffer);
                setBarcodeBuffer("");
            } else {
                if (e.key.length === 1) setBarcodeBuffer(prev => prev + e.key);
            }
            setLastCharTime(now);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [barcodeBuffer, lastCharTime, inventory]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [invRes, prescRes] = await Promise.all([
                supabase.from('medicine').select('*').order('med_name'),
                supabase.from('prescriptions')
                    .select(`
                        id,
                        appointment_id,
                        drug_name,
                        dosage,
                        total_quantity,
                        instructions,
                        frequency,
                        route,
                        duration,
                        refills_count,
                        dispensing_instructions,
                        created_at,
                        appointment!inner(
                            appodate,
                            patient!inner(pid, pname, ptel),
                            schedule!inner(
                                doctor!inner(docname)
                            )
                        )
                    `)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
            ]);

            if (invRes.error) throw invRes.error;
            if (prescRes.error) throw prescRes.error;

            const invData = invRes.data || [];
            const prescData = prescRes.data || [];
            
            setInventory(invData);
            setPrescriptions(fetchPrescriptions(prescData));
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    // Helper to group prescriptions
    const fetchPrescriptions = (data) => {
        const groupedMap = {};
        (data || []).forEach(p => {
            const aid = p.appointment_id || 'unlinked';
            if (!groupedMap[aid]) {
                groupedMap[aid] = {
                    id: p.id,
                    appointment_id: aid,
                    pid: p.appointment?.patient?.pid,
                    pname: p.appointment?.patient?.pname || 'Unknown',
                    ptel: p.appointment?.patient?.ptel || '',
                    docname: p.appointment?.schedule?.doctor?.docname || 'Unknown',
                    consultation_date: p.appointment?.appodate,
                    drug_count: 0,
                    drug_list_items: [],
                    created_at: p.created_at
                };
            }
            groupedMap[aid].drug_count += 1;
            const drugStr = [
                p.drug_name, p.dosage, p.total_quantity, p.instructions,
                p.frequency || '', p.route || '', p.duration || '',
                p.refills_count || '0', p.dispensing_instructions || ''
            ].join('::');
            groupedMap[aid].drug_list_items.push(drugStr);
        });
        
        return Object.values(groupedMap).map(g => ({
            ...g,
            drug_list: g.drug_list_items.join('|||')
        })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    };

    const handleBarcode = (code) => {
        const item = inventory.find(i => i.barcode === code || i.batch_no === code);
        if (item) {
            addToCart(item);
            showNotification(`Scanned: ${item.med_name}`, 'success');
        }
    };

    const addToCart = (item) => {
        const isExpired = new Date(item.expiry_date) < new Date();
        const stock = item.stock_qty || 0;
        const name = item.med_name || 'Medicine';

        if (isExpired) {
            showNotification(`CLINICAL BLOCK: ${name} is EXPIRED! Disposal/Recall required.`, 'error');
            return;
        }

        if (stock <= 0) {
            showNotification(`STOCK BLOCK: ${name} is OUT OF STOCK.`, 'error');
            return;
        }

        // Prescription Gating: If required, must have a selected prescription (Doctor ID linked via appointment)
        if (item.prescription_required && !selectedPresc) {
            showNotification(`SAFETY BLOCK: ${name} requires a valid prescription. Please select a patient from the clinical queue first.`, 'error');
            return;
        }

        const mid = item.id;
        const existing = cart.find(c => c.id === mid);
        if (existing) {
            if (existing.qty >= stock) {
                showNotification(`QUANTITY LIMIT: Max stock reached (${stock}).`, 'warning');
                return;
            }
            setCart(cart.map(c => c.id === mid ? { ...c, qty: c.qty + 1 } : c));
        } else {
            setCart([...cart, { 
                ...item, 
                id: mid,
                name: name,
                qty: 1, 
                price: item.selling_price || 0, 
                tax_rate: item.tax_rate || 0,
                prescription_required: item.prescription_required 
            }]);
        }
    };

    const handleSelectPresc = (p) => {
        setSelectedPresc(p);
        const errors = {};
        let hasBlockingError = false;
        const newItems = [];
        
        if (p.drug_list) {
            const drugs = p.drug_list.split('|||').map(d => {
                const parts = d.split('::');
                return { name: parts[0], dosage: parts[1], qty: parseInt(parts[2]) || 1 };
            });

            drugs.forEach(drug => {
                const allCandidates = inventory.filter(i => (i.med_name || '').toLowerCase().includes(drug.name.toLowerCase()));
                const validCandidates = allCandidates
                    .filter(i => (i.stock_qty || 0) > 0 && new Date(i.expiry_date) >= new Date())
                    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

                if (validCandidates.length > 0) {
                    const bestMatch = validCandidates[0];
                    newItems.push({ 
                        ...bestMatch, 
                        id: bestMatch.id,
                        name: bestMatch.med_name,
                        qty: drug.qty, 
                        price: bestMatch.selling_price || 0, 
                        tax_rate: bestMatch.tax_rate || 0,
                        prescription_required: bestMatch.prescription_required 
                    });
                } else {
                    hasBlockingError = true;
                    errors[drug.name.toLowerCase()] = { type: 'stock', message: 'Item unavailable or expired.' };
                }
            });

            setCart(newItems);
            if (hasBlockingError) {
                setIntelModal({ open: true, data: { ...p, errors, type: 'prescription' } });
                showNotification(`Partial fulfillment: Some items were unavailable.`, 'warning');
            } else {
                showNotification(`Success: All ${newItems.length} items added.`, 'success');
            }
        }
    };

    const updateQty = (id, delta) => {
        setCart(cart.map(c => {
            if (c.id === id) {
                const newQty = Math.max(1, c.qty + delta);
                const stock = inventory.find(i => i.id === id)?.stock_qty || 0;
                return { ...c, qty: Math.min(newQty, stock) };
            }
            return c;
        }));
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(c => c.id !== id));
    };

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const taxAmount = cart.reduce((acc, item) => acc + (item.price * item.qty * (item.tax_rate / 100)), 0);
    const total = subtotal + taxAmount;

    const handleReview = () => {
        if (cart.length === 0) return;
        setReceiptModal({
            open: true,
            data: {
                receiptNo: `DRAFT-${Date.now().toString().slice(-4)}`,
                items: cart, subtotal, taxAmount, total,
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                customerName: selectedPresc ? selectedPresc.pname : 'Walk-in Customer',
                paymentMethod,
                isDraft: true
            }
        });
    };

    const initiateStkPush = async () => {
        if (!mpesaPhone) {
            showNotification("Please enter the M-Pesa phone number", 'warning');
            return;
        }
        try {
            setStkLoading(true);
            const receiptNo = `RX-${Date.now().toString().slice(-6).toUpperCase()}`;
            setPendingReceiptNo(receiptNo); // Save for finalize step

            const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
                body: {
                    phone: mpesaPhone,
                    amount: total,
                    reference_id: receiptNo,
                    reference_type: 'pharmacy_sale'
                }
            });
            if (error) throw error;
            showNotification("STK Push initiated! Please check phone.", 'success');
        } catch (err) {
            console.error("STK Push failed", err);
            showNotification(`Error: ${err.message}`, 'error');
        } finally {
            setStkLoading(false);
        }
    };

    const handleFinalize = async (mode = 'save') => {
        setLoading(true);
        try {
            const receiptNo = pendingReceiptNo || `RX-${Date.now().toString().slice(-6).toUpperCase()}`;
            
            // 1. Insert into pharmacy_sale
            const salePayload = {
                pid: selectedPresc ? selectedPresc.pid : null,
                customer_name: selectedPresc ? selectedPresc.pname : 'Walk-in Customer',
                total_amount: subtotal,
                tax_amount: taxAmount,
                grand_total: total,
                discount_amount: 0,
                payment_method: paymentMethod,
                clinical_verification: selectedPresc ? 'Prescription Verified' : 'Walk-in Sale',
                receipt_no: receiptNo
            };
            
            // Attach pharmacist_id from profile if available
            if (profile?.phid) {
                salePayload.pharmacist_id = profile.phid;
            }
            
            const { data: saleData, error: saleError } = await supabase.from('pharmacy_sale').insert(salePayload).select('id').single();
            
            if (saleError) {
                console.error("Sale insertion error:", saleError);
                throw saleError;
            }
            
            if (!saleData) {
                throw new Error("Failed to retrieve sale ID after insertion.");
            }
            
            const saleId = saleData.id;
            
            // 2. Insert items
            const saleItems = cart.map(item => ({
                sale_id: saleId,
                medicine_id: item.id,
                quantity: item.qty,
                qty_sold: item.qty,
                unit_price: item.price,
                selling_price: item.price,
                subtotal: item.price * item.qty,
                tax_amount: item.price * item.qty * (item.tax_rate / 100)
            }));
            
            const { error: itemsError } = await supabase.from('pharmacy_sale_item').insert(saleItems);
            if (itemsError) throw itemsError;
            
            // 3. Update stock 
            for (const item of cart) {
                const drug = inventory.find(i => i.id === item.id);
                const currentStock = drug?.stock_qty || 0;
                await supabase.from('medicine').update({ stock_qty: currentStock - item.qty }).eq('id', item.id);
            }
            
            // 4. Mark prescription as dispensed
            if (selectedPresc && selectedPresc.appointment_id) {
                await supabase.from('prescriptions').update({ status: 'dispensed' }).eq('appointment_id', selectedPresc.appointment_id);
            }
            
            if (mode === 'print') {
                showNotification("Transaction saved! Preparing print...", 'success');
                setTimeout(() => window.print(), 1000);
            } else if (mode === 'share') {
                showNotification("Transaction saved! Generating shareable link...", 'success');
            } else {
                showNotification("Transaction completed and saved to Sales Log!", 'success');
            }

            setReceiptModal({
                open: true,
                data: {
                    ...receiptModal.data,
                    receiptNo: receiptNo,
                    isDraft: false
                }
            });
            setCart([]); setSelectedPresc(null);
            fetchData();
            
        } catch (err) {
            console.error("FINALIZE ERROR:", err);
            showNotification(`Error: ${err.message || "Failed to save transaction"}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '0px', maxWidth: '100%', margin: '0', background: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                {/* Edoc Style Header */}
                <header style={{ 
                    padding: '20px 30px', 
                    borderBottom: '1px solid #dee2e6', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: '#ffffff'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ padding: '8px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', color: '#007bff' }}>
                            <ShoppingCart size={20} />
                        </div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#343a40' }}>POS Workbench</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#007bff', background: '#e7f2ff', padding: '6px 12px', borderRadius: '4px' }}>
                            <QrCode size={14} style={{ marginRight: '8px' }} /> SCANNER ACTIVE
                        </div>
                        <NotificationCenter />
                    </div>
                </header>

                <div className="pharma-workbench-grid" style={{ flex: 1, padding: '24px 40px' }}>
                    
                    {/* Catalog Section */}
                    <section style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        
                        {/* Edoc Queue Section */}
                        <div style={{ background: 'white', borderRadius: '4px', border: '1px solid #dee2e6', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#007bff', margin: 0 }}>Clinical Queue</h3>
                                    <div style={{ position: 'relative', width: '210px', minWidth: '180px' }}>
                                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#adb5bd' }} />
                                        <input 
                                            type="text" 
                                            placeholder="Search Patient/Doctor..." 
                                            style={{ width: '100%', padding: '6px 10px 6px 30px', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.8rem' }}
                                            value={queueSearch}
                                            onChange={(e) => setQueueSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#6c757d' }}>{prescriptions.length} PENDING</span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
                                {(prescriptions || []).filter(p => {
                                    if (!p) return false;
                                    const search = (queueSearch || '').toLowerCase();
                                    return (
                                        (p.pname || '').toLowerCase().includes(search) || 
                                        (p.docname || '').toLowerCase().includes(search)
                                    );
                                }).map(p => (
                                    <div 
                                        key={p.id} 
                                        className="pharma-workbench-queue-card"
                                        style={{ 
                                            minWidth: '180px',
                                            padding: '15px', 
                                            borderRadius: '4px', 
                                            border: `1px solid ${selectedPresc?.id === p.id ? '#007bff' : '#dee2e6'}`,
                                            background: selectedPresc?.id === p.id ? '#f8f9fa' : '#ffffff',
                                            cursor: 'pointer',
                                            transition: '0.2s',
                                            position: 'relative'
                                        }}
                                        onClick={() => handleSelectPresc(p)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#343a40' }}>{p.pname}</div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setIntelModal({ open: true, data: { type: 'prescription', ...p } }); }}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6c757d' }}
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#6c757d', display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                                            <span>Dr. {p.docname}</span>
                                            <span style={{ color: '#007bff', fontWeight: '700' }}>{p.drug_count} Drugs</span>
                                        </div>
                                    </div>
                                ))}
                                {prescriptions.length === 0 && <div style={{ color: '#adb5bd', fontSize: '0.85rem', padding: '10px' }}>No pending prescriptions.</div>}
                            </div>
                        </div>

                        {/* Edoc Search & Grid */}
                        <div style={{ background: 'white', borderRadius: '4px', border: '1px solid #dee2e6', padding: '25px', flex: 1 }}>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Search size={18} style={{ position: 'absolute', left: '15px', top: '12px', color: '#adb5bd' }} />
                                    <input 
                                        type="text" 
                                        placeholder="Search by Medicine Name, Formula or Batch..." 
                                        style={{ width: '100%', padding: '10px 15px 10px 45px', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.9rem', background: '#f8f9fa' }} 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '600' }}>Search</button>
                            </div>

                            <div className="pharma-workbench-inventory">
                                {(inventory || []).filter(item => {
                                    if (!item) return false;
                                    const search = (searchTerm || '').toLowerCase();
                                    return (
                                        (item.med_name || '').toLowerCase().includes(search) ||
                                        (item.generic_name || '').toLowerCase().includes(search)
                                    );
                                }).slice(0, 12).map(item => {
                                    const expiryDate = new Date(item.expiry_date);
                                    const today = new Date();
                                    const isExpired = expiryDate < today;
                                    const stock = item.stock_qty || 0;
                                    const isNearingExpiry = !isExpired && expiryDate < new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

                                    return (
                                        <div 
                                            key={item.id} 
                                            onClick={() => setIntelModal({ open: true, data: { ...item, type: 'drug' } })}
                                            style={{ 
                                                padding: '15px', 
                                                border: '1px solid #dee2e6', 
                                                borderRadius: '4px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                background: isExpired ? '#fee2e2' : (stock <= 0 ? '#f1f5f9' : (isNearingExpiry ? '#fffaf0' : '#ffffff')),
                                                opacity: (isExpired || stock <= 0) ? 0.8 : 1,
                                                borderLeft: isExpired ? '4px solid #ef4444' : (stock <= 0 ? '4px solid #94a3b8' : '1px solid #dee2e6'),
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: isExpired ? '#dc3545' : (isNearingExpiry ? '#fd7e14' : '#343a40') }}>
                                                    {item.med_name}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                                                    KSh {Number(item.selling_price || 0).toFixed(2)} • <span style={{ color: stock <= 0 ? '#dc3545' : (stock < 10 ? '#fd7e14' : '#28a745'), fontWeight: '700' }}>
                                                        {stock <= 0 ? 'UNAVAILABLE' : `${stock} Left`}
                                                    </span>
                                                </div>
                                                {isExpired ? (
                                                    <div style={{ fontSize: '0.65rem', color: '#dc3545', fontWeight: '800', marginTop: '4px' }}>EXPIRED</div>
                                                ) : isNearingExpiry ? (
                                                    <div style={{ fontSize: '0.65rem', color: '#fd7e14', fontWeight: '800', marginTop: '4px' }}>EXPIRING SOON ({item.expiry_date})</div>
                                                ) : null}
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                                                style={{ 
                                                    padding: '6px', 
                                                    background: (isExpired || stock <= 0) ? '#f1f5f9' : '#e7f2ff', 
                                                    color: (isExpired || item.quantity <= 0) ? '#94a3b8' : '#007bff', 
                                                    border: 'none', 
                                                    borderRadius: '4px', 
                                                    cursor: (isExpired || item.quantity <= 0) ? 'not-allowed' : 'pointer',
                                                    position: 'relative',
                                                    zIndex: 10
                                                }}
                                                disabled={isExpired || item.quantity <= 0}
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* Edoc Style Sidebar Cart */}
                    <section style={{ background: '#ffffff', borderRadius: '4px', border: '1px solid #dee2e6', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#343a40' }}>Dispensing Cart</h3>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#007bff', background: '#e7f2ff', padding: '4px 10px', borderRadius: '100px' }}>{cart.length} ITEMS</span>
                        </div>

                        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                            {selectedPresc && (
                                <div style={{ padding: '12px', background: '#e7f2ff', border: '1px solid #007bff', borderRadius: '4px', marginBottom: '20px', fontSize: '0.85rem' }}>
                                    <div style={{ fontWeight: '700', color: '#007bff' }}>{selectedPresc.pname}</div>
                                    <div style={{ color: '#0056b3', fontSize: '0.75rem' }}>RX ID: #{selectedPresc.id}</div>
                                </div>
                            )}

                            {cart.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: '#adb5bd' }}>
                                    <ShoppingCart size={40} style={{ marginBottom: '10px' }} />
                                    <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>Empty Cart</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {cart.map(item => (
                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#343a40' }}>{item.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>KSh {item.price}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button onClick={() => updateQty(item.id, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#007bff' }}><Minus size={14} /></button>
                                                <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{item.qty}</span>
                                                <button onClick={() => updateQty(item.id, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#007bff' }}><Plus size={14} /></button>
                                                <button onClick={() => removeFromCart(item.id)} style={{ color: '#dc3545', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '25px', borderTop: '1px solid #dee2e6', background: '#f8f9fa' }}>
                            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#6c757d' }}>
                                    <span>Subtotal</span>
                                    <span style={{ fontWeight: '700' }}>KSh {subtotal.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#6c757d' }}>
                                    <span>Cumulative VAT</span>
                                    <span style={{ fontWeight: '700' }}>+ KSh {taxAmount.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #dee2e6', fontSize: '1.25rem', fontWeight: '700', color: '#007bff' }}>
                                    <span>TOTAL</span>
                                    <span>KSh {total.toLocaleString()}</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
                                {['Cash', 'Card', 'M-Pesa'].map(m => (
                                    <button 
                                        key={m}
                                        onClick={() => setPaymentMethod(m)}
                                        style={{ 
                                            padding: '10px 5px', 
                                            borderRadius: '4px', 
                                            border: `1px solid ${paymentMethod === m ? '#007bff' : '#dee2e6'}`,
                                            background: paymentMethod === m ? '#e7f2ff' : '#ffffff',
                                            color: paymentMethod === m ? '#007bff' : '#6c757d',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>

                            {paymentMethod === 'M-Pesa' && (
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#6c757d', marginBottom: '8px' }}>M-Pesa Phone Number</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. 07XXXXXXXX"
                                        value={mpesaPhone} 
                                        onChange={e => setMpesaPhone(e.target.value)}
                                        style={{ width: '100%', padding: '10px', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.85rem' }}
                                    />
                                    <button 
                                        onClick={initiateStkPush}
                                        disabled={stkLoading || cart.length === 0}
                                        style={{ width: '100%', marginTop: '8px', padding: '10px', border: 'none', background: '#8b5cf6', color: 'white', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        {stkLoading ? 'Sending Prompt...' : 'Send STK Push'}
                                    </button>
                                </div>
                            )}


                            <button 
                                onClick={handleReview}
                                disabled={cart.length === 0 || loading}
                                style={{ width: '100%', padding: '15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '700', fontSize: '1rem', cursor: 'pointer' }}
                            >
                                {loading ? 'Processing...' : 'Review & Print Receipt'}
                            </button>
                        </div>
                    </section>
                </div>

                <EntityDetailModal 
                    isOpen={intelModal.open} 
                    onClose={() => setIntelModal({ open: false, data: null })} 
                    data={intelModal.data} 
                    type={intelModal.data?.type || 'drug'}
                />
                
            <ReceiptModal 
                isOpen={receiptModal.open} 
                onClose={() => setReceiptModal({ open: false, data: null })} 
                saleData={receiptModal.data} 
                onFinalize={handleFinalize}
                loading={loading}
            />

            {success && (
                <div style={{ 
                    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 
                    background: '#28a745', color: 'white', padding: '12px 25px', borderRadius: '4px', 
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 3000, fontWeight: '600'
                }}>
                    {success}
                </div>
            )}
        </div>
    );
};

export default PharmaWorkbench;
