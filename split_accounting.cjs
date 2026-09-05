const fs = require('fs');

const file = fs.readFileSync('src/pages/admin/AccountingPage.jsx', 'utf8');

const importsAndConstantsMatch = file.match(/^(import[\s\S]*?)function ChartOfAccountsView/);
const importsAndConstants = importsAndConstantsMatch ? importsAndConstantsMatch[1] : '';

let views = [
    { search: 'function ChartOfAccountsView',    name: 'WorkshopChartOfAccounts.jsx' },
    { search: 'function CashBankView',           name: 'WorkshopCashBank.jsx' },
    { search: 'function PaymentsView',           name: 'WorkshopPayments.jsx' },
    { search: 'function TransactionEntryView',   name: 'WorkshopTransactions.jsx' },
    { search: 'function GeneralJournalView',     name: 'WorkshopJournalEntries.jsx' },
    { search: 'function PurchasesView',          name: 'WorkshopAccountingPurchases.jsx' },
    { search: 'function ExpensesView',           name: 'WorkshopExpenses.jsx' },
    { search: 'function ReceiptsView',           name: 'WorkshopReceipts.jsx' },
    { search: 'function EmployeeAdvancesView',   name: 'WorkshopAdvances.jsx' },
    { search: 'function LedgerView',             name: 'WorkshopLedger.jsx' }
];

// Determine actual order in file
for (let v of views) {
    v.index = file.indexOf(v.search);
}

// Sort by appearance in file
views.sort((a, b) => a.index - b.index);

for (let i = 0; i < views.length; i++) {
    const currentView = views[i];
    const nextView = views[i + 1];
    
    const startIndex = currentView.index;
    const endIndex = nextView ? nextView.index : file.indexOf('export default function AccountingPage');
    
    let viewContent = file.substring(startIndex, endIndex);
    
    let defaultExportName = currentView.search.replace('function ', '').split('(')[0];
    
    let outContent = importsAndConstants + '\n' + viewContent + '\nexport default ' + defaultExportName + ';\n';
    
    outContent = outContent.replace(/import Modal from '\.\.\/\.\.\/components\/Modal';/, "import Modal from '../../../components/Modal';");
    outContent = outContent.replace(/import '\.\.\/\.\.\/styles\/admin\/AccountingPage\.css';/, "import '../../../styles/admin/AccountingPage.css';");
    
    fs.writeFileSync('src/pages/workshop/accounting/' + currentView.name, outContent);
}

console.log('Split completed correctly!');
