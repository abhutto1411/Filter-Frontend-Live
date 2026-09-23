import React from 'react';
import { useNavigate } from 'react-router-dom';
import PlatformChatPage from '../admin/PlatformChatPage';
import { TECHNICIAN_CHAT_CONFIG } from '../admin/platformChatConfigs';

export default function TechnicianPlatformChatPage() {
    const navigate = useNavigate();
    return (
        <PlatformChatPage
            chatConfig={TECHNICIAN_CHAT_CONFIG}
            onExit={() => navigate('/technician/home')}
        />
    );
}
