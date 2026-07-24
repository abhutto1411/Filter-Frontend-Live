import React from 'react';
import { useNavigate } from 'react-router-dom';
import PlatformChatPage from '../admin/PlatformChatPage';
import { CASHIER_CHAT_CONFIG } from '../admin/platformChatConfigs';

export default function CashierPlatformChatPage() {
    const navigate = useNavigate();
    return (
        <PlatformChatPage
            chatConfig={CASHIER_CHAT_CONFIG}
            onExit={() => navigate('/pos/home')}
        />
    );
}
