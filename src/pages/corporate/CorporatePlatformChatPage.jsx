import React from 'react';
import { useNavigate } from 'react-router-dom';
import PlatformChatPage from '../admin/PlatformChatPage';
import { CORPORATE_CHAT_CONFIG } from '../admin/platformChatConfigs';

export default function CorporatePlatformChatPage() {
    const navigate = useNavigate();
    return (
        <PlatformChatPage
            chatConfig={CORPORATE_CHAT_CONFIG}
            onExit={() => navigate('/corporate/dashboard')}
        />
    );
}
