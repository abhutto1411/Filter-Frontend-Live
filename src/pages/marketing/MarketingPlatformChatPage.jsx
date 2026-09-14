import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PlatformChatPage from '../admin/PlatformChatPage';
import { MARKETING_CHAT_CONFIG } from '../admin/platformChatConfigs';

export default function MarketingPlatformChatPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const exitPath = user?.walletEnabled ? '/marketing/my-wallet' : '/marketing/dashboard';
    return (
        <PlatformChatPage
            chatConfig={MARKETING_CHAT_CONFIG}
            onExit={() => navigate(exitPath, { replace: true })}
        />
    );
}
