import {
    createPlatformChatApi,
    workshopPlatformChatApi,
    supplierPlatformChatApi,
    corporatePlatformChatApi,
    technicianPlatformChatApi,
    cashierPlatformChatApi,
    marketingPlatformChatApi,
} from '../../services/platformChatApi';

export const NEW_CHAT_MODES = {
    MENU: 'menu',
    ADMIN: 'admin',
    SUPPLIER: 'supplier',
    WORKSHOP: 'workshop',
    WORKSHOP_USERS: 'workshop_users',
    WORKSHOP_TEAM: 'workshop_team',
    CORPORATE: 'corporate',
    STAFF: 'staff',
    GROUP: 'group',
    GROUP_WORKSHOP: 'group_workshop',
    GROUP_WORKSHOP_USERS: 'group_workshop_users',
};

export const ADMIN_CHAT_CONFIG = {
    id: 'admin',
    api: createPlatformChatApi('/super-admin/platform-chat'),
    viewPermission: 'chat.view',
    createPermission: 'chat.create',
    useLegacyContacts: true,
    menuItems: ['admin', 'supplier', 'workshop', 'corporate', 'group'],
    adminContactLabel: 'Super Admin',
    groupCategories: [
        { id: 'all', label: 'All' },
        { id: 'supplier', label: 'Suppliers' },
        { id: 'workshop', label: 'Workshops' },
        { id: 'corporate', label: 'Corporate' },
    ],
    showWorkshopRoleTabs: true,
    allowGroups: true,
};

export const WORKSHOP_CHAT_CONFIG = {
    id: 'workshop',
    api: workshopPlatformChatApi,
    viewPermission: 'workshop.platform-chat.view',
    createPermission: 'workshop.platform-chat.create',
    useLegacyContacts: false,
    menuItems: ['admin', 'supplier', 'workshop_team', 'group'],
    groupCategories: [
        { id: 'all', label: 'All' },
        { id: 'admin', label: 'Filter Admin' },
        { id: 'supplier', label: 'Suppliers' },
        { id: 'workshop', label: 'Team' },
    ],
    showWorkshopRoleTabs: true,
    allowGroups: true,
};

export const MARKETING_CHAT_CONFIG = {
    id: 'marketing',
    api: marketingPlatformChatApi,
    viewPermission: 'marketing.platform-chat.view',
    createPermission: 'marketing.platform-chat.create',
    useLegacyContacts: true,
    menuItems: ['admin', 'supplier', 'workshop', 'corporate', 'group'],
    adminContactLabel: 'Filter Admin',
    groupCategories: [
        { id: 'all', label: 'All' },
        { id: 'supplier', label: 'Suppliers' },
        { id: 'workshop', label: 'Workshops' },
        { id: 'corporate', label: 'Corporate' },
    ],
    showWorkshopRoleTabs: true,
    allowGroups: true,
    skipWorkshopWalletFields: true,
};

export const SUPPLIER_WORKSHOP_ROLE_TABS = [
    { id: 'all', label: 'All' },
    { id: 'admin', label: 'Admins' },
];

export const SUPPLIER_CHAT_CONFIG = {
    id: 'supplier',
    api: supplierPlatformChatApi,
    useLegacyContacts: false,
    menuItems: ['admin', 'workshop', 'group'],
    groupCategories: [
        { id: 'all', label: 'All' },
        { id: 'admin', label: 'Filter Admin' },
        { id: 'workshop', label: 'Workshops' },
    ],
    showWorkshopRoleTabs: true,
    workshopRoleTabs: SUPPLIER_WORKSHOP_ROLE_TABS,
    allowGroups: true,
};

export const CORPORATE_CHAT_CONFIG = {
    id: 'corporate',
    api: corporatePlatformChatApi,
    useLegacyContacts: false,
    menuItems: ['staff', 'group'],
    groupCategories: [{ id: 'workshop', label: 'Workshop' }],
    showWorkshopRoleTabs: false,
    allowGroups: true,
};

export const TECHNICIAN_CHAT_CONFIG = {
    id: 'technician',
    api: technicianPlatformChatApi,
    useLegacyContacts: false,
    menuItems: ['staff', 'group'],
    groupCategories: [{ id: 'workshop', label: 'Team' }],
    showWorkshopRoleTabs: false,
    allowGroups: true,
};

export const CASHIER_CHAT_CONFIG = {
    id: 'cashier',
    api: cashierPlatformChatApi,
    useLegacyContacts: false,
    menuItems: ['staff', 'group'],
    groupCategories: [{ id: 'workshop', label: 'Team' }],
    showWorkshopRoleTabs: false,
    allowGroups: true,
};
