import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { BASE_URL, apiFetch, clientUtcOffsetMinutes } from '../services/api';
import { useAuth } from './AuthContext';

const POSContext = createContext(null);

/** Oldest order id first (matches backend GET /cashier/orders FIFO). */
function sortCashierOrdersOldestFirst(list) {
    return [...list].sort((a, b) => {
        try {
            const ai = BigInt(String(a?.id ?? '0'));
            const bi = BigInt(String(b?.id ?? '0'));
            if (ai < bi) return -1;
            if (ai > bi) return 1;
            return 0;
        } catch {
            return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
        }
    });
}

export const POSProvider = ({ children }) => {
    const { token, user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [orders, setOrders] = useState([]);
    const [broadcasts, setBroadcasts] = useState([]);
    const [activeOrder, setActiveOrder] = useState(null);
    const [cart, setCart] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(false);
    const [catalogLoading, setCatalogLoading] = useState(false);

    // Fetch initial orders
    const refreshOrders = useCallback(async () => {
        try {
            const d = await apiFetch(
                `/cashier/orders?utcOffsetMinutes=${clientUtcOffsetMinutes()}`,
            );
            setOrders(sortCashierOrdersOldestFirst(d.orders || d.data || []));
        } catch (err) {
            console.error('Failed to fetch orders:', err);
        }
    }, []);

    const refreshCatalog = useCallback(async () => {
        setCatalogLoading(true);
        try {
            const branchId = user?.branchId || user?.branch_id || '5';
            const d = await apiFetch(`/workshop-staff/branches/${branchId}/catalog`);
            const depts = d.departments || d.data || [];
            setCatalog(Array.isArray(depts) ? depts : []);
        } catch (err) {
            console.error('Failed to fetch catalog:', err);
        } finally {
            setCatalogLoading(false);
        }
    }, [user]);

    // Socket initialization
    useEffect(() => {
        if (!token) return;

        const newSocket = io(BASE_URL, {
            extraHeaders: {
                Authorization: `Bearer ${token}`
            }
        });

        newSocket.on('connect', () => {
            console.log('POS Socket connected');
        });

        // Listen for order updates from technicians/other cashiers
        newSocket.on('ordersUpdated', () => {
            console.log('Orders updated signal received');
            refreshOrders();
        });

        // Listen for urgent technician help broadcasts
        newSocket.on('broadcastUpdated', (data) => {
            console.log('Broadcast received:', data);
            setBroadcasts(prev => [...prev, { ...data, id: Date.now() }]);
        });

        setSocket(newSocket);
        refreshOrders();

        return () => {
            newSocket.disconnect();
        };
    }, [token, refreshOrders]);

    const dismissBroadcast = (id) => {
        setBroadcasts(prev => prev.filter(b => b.id !== id));
    };

    const clearActiveOrder = () => {
        setActiveOrder(null);
        setCart([]);
    };

    const markJobEdited = async (jobId) => {
        try {
            await apiFetch(`/cashier/job/${jobId}/mark-edited`, { method: 'PATCH' });
            refreshOrders();
            return true;
        } catch (err) {
            console.error('Failed to mark job edited:', err);
            throw err;
        }
    };

    const addToCart = (product, quantity = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prev, { product, quantity, discount: 0, isDiscountPercent: false }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateCartQuantity = (productId, delta) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.product.id === productId) {
                    const newQty = Math.max(0.1, item.quantity + delta);
                    return { ...item, quantity: item.product.allowDecimalQty ? newQty : Math.floor(newQty) };
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };

    const clearCart = () => setCart([]);

    return (
        <POSContext.Provider value={{
            socket,
            orders,
            refreshOrders,
            broadcasts,
            dismissBroadcast,
            activeOrder,
            setActiveOrder,
            cart,
            setCart,
            addToCart,
            removeFromCart,
            updateCartQuantity,
            clearCart,
            catalog,
            catalogLoading,
            refreshCatalog,
            clearActiveOrder,
            markJobEdited,
            loading,
            setLoading
        }}>
            {children}
        </POSContext.Provider>
    );
};

export const usePOS = () => {
    const context = useContext(POSContext);
    if (!context) {
        throw new Error('usePOS must be used within a POSProvider');
    }
    return context;
};
