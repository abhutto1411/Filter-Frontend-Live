import React from 'react';
import { useNavigate } from 'react-router-dom';
import PlatformChatPage from '../admin/PlatformChatPage';
import { SUPPLIER_CHAT_CONFIG } from '../admin/platformChatConfigs';

export default function SupplierPlatformChatPage() {
    const navigate = useNavigate();
    return (
        <PlatformChatPage
            chatConfig={SUPPLIER_CHAT_CONFIG}
            onExit={() => navigate('/supplier/dashboard')}
        />
    );
}
