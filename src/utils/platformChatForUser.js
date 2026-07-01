import {
    createPlatformChatApi,
    workshopPlatformChatApi,
    supplierPlatformChatApi,
    corporatePlatformChatApi,
    technicianPlatformChatApi,
    cashierPlatformChatApi,
} from '../services/platformChatApi';

const CHAT_USER_TYPES = new Set([
    'platform_admin',
    'workshop_user',
    'workshop_owner',
    'supplier_user',
    'corporate_user',
    'technician_user',
    'cashier_user',
]);

export function isPlatformChatUser(user) {
    return Boolean(user?.userType && CHAT_USER_TYPES.has(user.userType));
}

export function resolvePlatformChatApi(user) {
    if (!user?.userType) return null;
    switch (user.userType) {
        case 'platform_admin':
            return createPlatformChatApi('/super-admin/platform-chat');
        case 'workshop_user':
        case 'workshop_owner':
            return workshopPlatformChatApi;
        case 'supplier_user':
            return supplierPlatformChatApi;
        case 'corporate_user':
            return corporatePlatformChatApi;
        case 'technician_user':
            return technicianPlatformChatApi;
        case 'cashier_user':
            return cashierPlatformChatApi;
        default:
            return null;
    }
}

export function isPlatformChatNavId(id) {
    return id === 'chat' || id === 'platform-chat';
}
