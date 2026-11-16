import { useState } from 'react';
import POSHome from '../../components/pos/POSHome';
import AddNewOrder from '../../components/pos/AddNewOrder';
import DepartmentSelect from '../../components/pos/DepartmentSelect';
import OrderBuilder from '../../components/pos/OrderBuilder';
import CorporateBookings from '../../components/pos/CorporateBookings';
import SalesReturnScreen from '../../components/pos/SalesReturnScreen';
import PettyCashScreen from '../../components/pos/PettyCashScreen';
import PromotionsScreen from '../../components/pos/PromotionsScreen';
import CounterClosingScreen from '../../components/pos/CounterClosingScreen';

// Screens: home | add_order | dept_select | order_builder | corporate_bookings | sales_return | petty_cash | promotions | counter_closing
export default function POSPage() {
    const [screen, setScreen] = useState('home');
    const [orderInfo, setOrderInfo] = useState(null);   // { type, customer, vehicle }
    const [selectedDept, setSelectedDept] = useState(null);
    const [prefilledCustomer, setPrefilledCustomer] = useState(null);
    const [createdOrderId, setCreatedOrderId] = useState(null); // API order ID after creation
    const [deptJobIds, setDeptJobIds] = useState({});  // { deptName: jobId }

    const goHome = () => {
        setScreen('home');
        setOrderInfo(null);
        setSelectedDept(null);
        setPrefilledCustomer(null);
        setCreatedOrderId(null);
        setDeptJobIds({});
    };

    if (screen === 'add_order') {
        return (
            <AddNewOrder
                onBack={() => setScreen('home')}
                prefilledCustomer={prefilledCustomer}
                onProceed={(info) => {
                    setOrderInfo(info);
                    setScreen('dept_select');
                }}
            />
        );
    }

    if (screen === 'dept_select' && orderInfo) {
        return (
            <DepartmentSelect
                orderInfo={orderInfo}
                onBack={() => setScreen('add_order')}
                onSelectDept={(dept) => {
                    setSelectedDept(dept);
                    setScreen('order_builder');
                }}
            />
        );
    }

    if (screen === 'order_builder') {
        return (
            <OrderBuilder
                orderInfo={orderInfo}
                department={selectedDept}
                createdOrderId={createdOrderId}
                deptJobIds={deptJobIds}
                onOrderCreated={(orderId, jobIds) => {
                    setCreatedOrderId(orderId);
                    setDeptJobIds(jobIds);
                }}
                onBack={() => setScreen('dept_select')}
                onComplete={goHome}
                onAddDept={() => setScreen('dept_select')}
            />
        );
    }

    if (screen === 'corporate_bookings') {
        return (
            <CorporateBookings
                onBack={goHome}
                onApproveAndEdit={(booking) => {
                    setOrderInfo({
                        type: 'corporate',
                        customer: { id: booking.customerId, name: booking.customerName, customer_type: 'corporate' },
                        vehicle: {},
                    });
                    setSelectedDept({ id: 'direct', name: 'Booked Service' });
                    setScreen('order_builder');
                }}
            />
        );
    }

    if (screen === 'sales_return') return <SalesReturnScreen onBack={goHome} />;
    if (screen === 'petty_cash') return <PettyCashScreen onBack={goHome} />;
    if (screen === 'promotions') return <PromotionsScreen onBack={goHome} />;
    if (screen === 'counter_closing') return <CounterClosingScreen onBack={goHome} onLogout={goHome} />;

    return (
        <POSHome
            onAddNewOrder={(customer) => {
                setPrefilledCustomer(customer || null);
                setScreen('add_order');
            }}
            onContinueOrder={(order) => {
                // Load existing order
                setCreatedOrderId(order.id);
                setScreen('home'); // stays on home, ActiveOrdersManager handles it
            }}
            onCorporateBookings={() => setScreen('corporate_bookings')}
            onSalesReturn={() => setScreen('sales_return')}
            onPettyCash={() => setScreen('petty_cash')}
            onPromo={() => setScreen('promotions')}
            onCounterClosing={() => setScreen('counter_closing')}
        />
    );
}
