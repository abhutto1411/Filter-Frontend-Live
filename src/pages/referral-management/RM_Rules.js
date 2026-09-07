export const MOCK_RULES = [
    { 
        id: 1, 
        type: 'Individual', 
        title: 'New Plate Promo',
        logic: 'One-Time Activation',
        limit: 500, 
        plateLimit: 1, 
        target: 'New Customers', 
        discount: 20, 
        perks: 'Free basic inspection',
        status: 'Active' 
    },
    { 
        id: 2, 
        type: 'Individual', 
        title: 'Loyalty Reward',
        logic: 'Plate Loyalty',
        limit: 1000, 
        plateLimit: 5, 
        target: 'Ongoing Customers', 
        discount: 5, 
        perks: '5th plate free',
        status: 'Active' 
    },
    { 
        id: 3, 
        type: 'Corporate', 
        title: 'Fleet Volume Discount',
        logic: 'Volume Tier',
        limit: 5000, 
        plateLimit: 50, 
        target: 'New Customers', 
        discount: 15, 
        perks: 'Priority Service & Express Lane',
        status: 'Active' 
    },
    { 
        id: 4, 
        type: 'Franchise', 
        title: 'Partner Benefit',
        logic: 'Commission Based',
        limit: 10000, 
        plateLimit: 20, 
        target: 'New Customers', 
        discount: 10, 
        perks: '1-Year Warranty Extension',
        status: 'Active' 
    },
];
