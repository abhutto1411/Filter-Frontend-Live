import { apiFetch, BASE_URL, getAuthToken } from './api';

const qs = (params = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
    });
    const s = sp.toString();
    return s ? `?${s}` : '';
};

/**
 * Factory for portal-scoped platform chat HTTP client.
 * @param {string} basePath e.g. `/super-admin/platform-chat` or `/workshop-staff/platform-chat`
 */
export function createPlatformChatApi(basePath) {
    const base = String(basePath || '/super-admin/platform-chat').replace(/\/$/, '');

    return {
        basePath: base,

        getUnreadSummary: () => apiFetch(`${base}/unread`),

        listConversations: () => apiFetch(`${base}/conversations`),

        createConversation: (body) =>
            apiFetch(`${base}/conversations`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),

        listMessages: (conversationId, params = {}) =>
            apiFetch(
                `${base}/conversations/${encodeURIComponent(String(conversationId))}/messages${qs(params)}`,
            ),

        sendMessage: (conversationId, body) =>
            apiFetch(
                `${base}/conversations/${encodeURIComponent(String(conversationId))}/messages`,
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                },
            ),

        ackConversation: (conversationId, level = 'read') =>
            apiFetch(
                `${base}/conversations/${encodeURIComponent(String(conversationId))}/ack`,
                {
                    method: 'POST',
                    body: JSON.stringify({ level }),
                },
            ),

        markMessagePlayed: (messageId) =>
            apiFetch(
                `${base}/messages/${encodeURIComponent(String(messageId))}/played`,
                { method: 'POST' },
            ),

        getConversation: (conversationId) =>
            apiFetch(
                `${base}/conversations/${encodeURIComponent(String(conversationId))}`,
            ),

        updateConversation: (conversationId, body) =>
            apiFetch(
                `${base}/conversations/${encodeURIComponent(String(conversationId))}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify(body),
                },
            ),

        manageMembers: (conversationId, body) =>
            apiFetch(
                `${base}/conversations/${encodeURIComponent(String(conversationId))}/members`,
                {
                    method: 'PATCH',
                    body: JSON.stringify(body),
                },
            ),

        uploadVoice: (blob, filename = 'voice.webm') => {
            const fd = new FormData();
            fd.append('file', blob, filename);
            return apiFetch(`${base}/upload/voice`, {
                method: 'POST',
                body: fd,
            });
        },

        /** Portal unified contacts (workshop, supplier, corporate, technician, cashier). */
        listContacts: (params = {}) => apiFetch(`${base}/contacts${qs(params)}`),

        listWorkshops: (params = {}) =>
            apiFetch(`${base}/contacts/workshops${qs(params)}`),

        listWorkshopUsers: (workshopId, params = {}) =>
            apiFetch(
                `${base}/contacts/workshops/${encodeURIComponent(String(workshopId))}/users${qs(params)}`,
            ),

        searchContacts: (params = {}) =>
            apiFetch(`${base}/contacts/search${qs(params)}`),

        /** Super-admin only legacy contact endpoints */
        listSupplierContacts: (params = {}) =>
            apiFetch(`${base}/contacts/suppliers${qs(params)}`),

        listAdminContacts: (params = {}) =>
            apiFetch(`${base}/contacts/admins${qs(params)}`),

        listCorporateContacts: (params = {}) =>
            apiFetch(`${base}/contacts/corporate${qs(params)}`),

        fetchVoiceBlob: async (fileUrl) => {
            const path = String(fileUrl || '').startsWith('http')
                ? String(fileUrl).replace(BASE_URL, '')
                : String(fileUrl || '');
            const normalized = path.startsWith('/') ? path : `/${path}`;
            const token = getAuthToken();
            const res = await fetch(`${BASE_URL}${normalized}`, {
                headers: token ? { Authorization: `Bearer ${token.trim()}` } : {},
            });
            if (!res.ok) {
                throw new Error('Could not load voice message');
            }
            return res.blob();
        },

        sendWalletFundRequest: (conversationId, body) =>
            apiFetch(
                `${base}/conversations/${encodeURIComponent(String(conversationId))}/wallet/fund-request`,
                { method: 'POST', body: JSON.stringify(body) },
            ),

        recordWalletExpense: (conversationId, body) =>
            apiFetch(
                `${base}/conversations/${encodeURIComponent(String(conversationId))}/wallet/expense`,
                { method: 'POST', body: JSON.stringify(body) },
            ),

        getWalletHistory: (conversationId, params = {}) => {
            const qs = new URLSearchParams();
            if (params.from) qs.set('from', params.from);
            if (params.to) qs.set('to', params.to);
            const query = qs.toString();
            return apiFetch(
                `${base}/conversations/${encodeURIComponent(String(conversationId))}/wallet/history${query ? `?${query}` : ''}`,
            );
        },

        sendWalletTxReference: (conversationId, body) =>
            apiFetch(
                `${base}/conversations/${encodeURIComponent(String(conversationId))}/wallet/tx-reference`,
                { method: 'POST', body: JSON.stringify(body) },
            ),

        approveWalletFundRequestMessage: (messageId, body) =>
            apiFetch(
                `${base}/messages/${encodeURIComponent(String(messageId))}/wallet/fund-request/approve`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),

        rejectWalletFundRequestMessage: (messageId, body) =>
            apiFetch(
                `${base}/messages/${encodeURIComponent(String(messageId))}/wallet/fund-request/reject`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),

        approveWalletExpenseRequestMessage: (messageId, body) =>
            apiFetch(
                `${base}/messages/${encodeURIComponent(String(messageId))}/wallet/expense-request/approve`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),

        rejectWalletExpenseRequestMessage: (messageId, body) =>
            apiFetch(
                `${base}/messages/${encodeURIComponent(String(messageId))}/wallet/expense-request/reject`,
                { method: 'PATCH', body: JSON.stringify(body) },
            ),
    };
}

const adminApi = createPlatformChatApi('/super-admin/platform-chat');

export const listPlatformChatConversations = adminApi.listConversations;
export const createPlatformChatConversation = adminApi.createConversation;
export const listPlatformChatMessages = adminApi.listMessages;
export const sendPlatformChatMessage = adminApi.sendMessage;
export const ackPlatformChatConversation = adminApi.ackConversation;
export const markPlatformChatMessagePlayed = adminApi.markMessagePlayed;
export const getPlatformChatConversation = adminApi.getConversation;
export const updatePlatformChatConversation = adminApi.updateConversation;
export const managePlatformChatMembers = adminApi.manageMembers;
export const uploadPlatformChatVoice = adminApi.uploadVoice;
export const listPlatformChatSupplierContacts = adminApi.listSupplierContacts;
export const listPlatformChatAdminContacts = adminApi.listAdminContacts;
export const listPlatformChatWorkshops = adminApi.listWorkshops;
export const listPlatformChatWorkshopUsers = adminApi.listWorkshopUsers;
export const listPlatformChatCorporateContacts = adminApi.listCorporateContacts;
export const searchPlatformChatContacts = adminApi.searchContacts;
export const fetchPlatformChatVoiceBlob = adminApi.fetchVoiceBlob;

export const workshopPlatformChatApi = createPlatformChatApi('/workshop-staff/platform-chat');
export const supplierPlatformChatApi = createPlatformChatApi('/supplier/platform-chat');
export const corporatePlatformChatApi = createPlatformChatApi('/corporate/platform-chat');
export const technicianPlatformChatApi = createPlatformChatApi('/technician/platform-chat');
export const cashierPlatformChatApi = createPlatformChatApi('/cashier/platform-chat');
export const marketingPlatformChatApi = createPlatformChatApi('/marketing/platform-chat');
