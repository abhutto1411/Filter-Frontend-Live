import React from 'react';
import { useNavigate } from 'react-router-dom';
import PlatformChatPage from '../admin/PlatformChatPage';
import { WORKSHOP_CHAT_CONFIG } from '../admin/platformChatConfigs';
import { useAuth } from '../../context/AuthContext';
import { firstVisibleWorkshopPath } from '../../utils/permissions';

function workshopChatExitPath(user) {
    if (user?.walletEnabled) {
        return '/workshop/my-wallet';
    }
    return firstVisibleWorkshopPath(user) || '/workshop/dashboard';
}

export default function WorkshopPlatformChatPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    return (
        <PlatformChatPage
            chatConfig={WORKSHOP_CHAT_CONFIG}
            onExit={() => navigate(workshopChatExitPath(user), { replace: true })}
        />
    );
}
