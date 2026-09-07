import { createMyWalletApi } from './adminWalletApi';

export const marketingMyWalletApi = createMyWalletApi('/super-admin-marketing-protal/my-wallet');

export function marketingMyWalletApiForUser(user) {
    if (user?.sessionPortal === 'marketing' || user?.userType === 'marketing_user') {
        return marketingMyWalletApi;
    }
    return marketingMyWalletApi;
}
