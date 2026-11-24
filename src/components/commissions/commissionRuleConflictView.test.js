import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildCommissionRuleConflictView,
    groupHeadingForReportRow,
} from './commissionRuleConflictView.js';

const EN = {
    'rules.err.generic': 'Something went wrong, please try again.',
    'rules.conflict.title': 'This rule conflicts with an existing rule',
    'rules.conflict.body':
        'This rule conflicts with an existing active rule at the same priority and role.',
    'rules.conflict.message':
        'Your rule conflicts with the existing rule "{name}" (#{id}), so it was NOT saved.',
    'rules.conflict.all': 'All',
    'rules.conflict.openDate': 'Open',
    'rules.conflict.sharedScope': 'the same scope',
    'rules.conflict.highlight':
        'Conflict: both rules are priority {priority} for {role} and both match: {items}',
    'rules.conflict.howToFix':
        'How to fix: change the priority of one rule (lower number is checked first), narrow the scope, or set one rule inactive.',
    'rules.conflict.heading.two':
        'Rules {a} and {b} conflict at priority {p} ({role})',
    'rules.conflict.heading.many':
        'Rules {list} conflict at priority {p} ({role})',
    'rules.conflict.listPair': '{a} and {b}',
    'rules.conflict.listSep': ', ',
    'rules.conflict.listAnd': ' and ',
    'rules.conflict.commission.percentage': 'Percentage',
    'rules.conflict.commission.fixed': 'Fixed amount',
    'rules.scope.km': '{km} KM',
    'rules.status.active': 'Active',
    'rules.status.inactive': 'Inactive',
    'rules.role.Technician': 'All technicians',
    'rules.role.cashier': 'Cashiers',
    'rules.appliesTo.all': 'Products & services',
    'rules.appliesTo.products': 'Products only',
    'rules.appliesTo.services': 'Services only',
    'rules.rate.profile': 'Profile %',
    'money.sar': 'SAR {amount}',
};

const AR = {
    ...EN,
    'rules.conflict.all': 'الكل',
    'rules.conflict.openDate': 'مفتوح',
    'rules.conflict.heading.two':
        'القاعدتان {a} و {b} تتعارضان عند الأولوية {p} ({role})',
    'rules.conflict.heading.many':
        'القواعد {list} تتعارض عند الأولوية {p} ({role})',
    'rules.conflict.listPair': '{a} و {b}',
    'rules.conflict.listSep': '، ',
    'rules.conflict.listAnd': ' و ',
    'rules.scope.km': '{km} كم',
    'rules.role.Technician': 'كل الفنيين',
};

const makeT = (pack) => (key, vars) => {
    let text = pack[key] ?? key;
    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, String(value));
        }
    }
    return text;
};

const t = makeT(EN);
const tAr = makeT(AR);

describe('buildCommissionRuleConflictView', () => {
    it('formats one duplicate-item conflict (save error shape: conflicts[].rule)', () => {
        const view = buildCommissionRuleConflictView(
            {
                code: 'COMMISSION_RULE_CONFLICT',
                conflicts: [
                    {
                        type: 'duplicate_item',
                        rule: {
                            id: '41',
                            name: 'Services',
                            status: 'active',
                            priority: 1,
                            employeeRole: 'Technician',
                            appliesTo: 'services',
                            commissionType: 'Percentage',
                            value: 20,
                            products: [],
                            services: [{ id: '8', name: 'Oil Change Service' }],
                            departments: [],
                            categories: [],
                            kmInterval: [],
                            branches: [],
                            employees: [],
                        },
                        sharedItems: [{ type: 'service', id: '8', name: 'Oil Change Service' }],
                    },
                ],
                totalConflicts: 1,
            },
            t,
        );
        assert.equal(view.isConflict, true);
        assert.match(view.message, /Services/);
        assert.match(view.message, /#41/);
        assert.equal(view.cards.length, 1);
        assert.equal(view.cards[0].type, 'duplicate_item');
        assert.equal(view.cards[0].name, 'Services');
        assert.equal(view.cards[0].services, 'Oil Change Service');
        assert.equal(view.cards[0].departments, 'All');
        assert.equal(view.cards[0].status, 'Active');
        assert.equal(view.cards[0].role, 'All technicians');
        assert.equal(view.cards[0].appliesTo, 'Services only');
        assert.match(view.cards[0].commission, /20%/);
        assert.match(view.cards[0].highlight, /Oil Change Service/);
        assert.equal(view.andMore, 0);
        assert.equal(view.groups[0].heading, null);
    });

    it('formats one overlap with shared items (save error shape)', () => {
        const view = buildCommissionRuleConflictView(
            {
                code: 'COMMISSION_RULE_CONFLICT',
                conflicts: [
                    {
                        type: 'overlap',
                        rule: {
                            id: '42',
                            name: 'Dept 20 services',
                            status: 'active',
                            priority: 1,
                            employeeRole: 'Technician',
                            appliesTo: 'services',
                            departments: [{ id: '20', name: 'Oil Change' }],
                            categories: [],
                            products: [],
                            services: [],
                            kmInterval: [],
                            branches: [],
                            employees: [],
                        },
                        sharedItems: [
                            { type: 'service', id: '1', name: 'Oil Change Service' },
                            { type: 'service', id: '2', name: 'Gear Oil Change' },
                        ],
                    },
                ],
                totalConflicts: 1,
            },
            t,
        );
        assert.equal(view.cards[0].type, 'overlap');
        assert.match(view.cards[0].highlight, /Oil Change Service, Gear Oil Change/);
        assert.equal(view.cards[0].categories, 'All');
        assert.equal(view.cards[0].km, 'All');
    });

    it('expands GET /conflicts report rows (rules[], ruleIds, ruleNames) into one card per rule', () => {
        // Shape from workshop-commissions.service.ts listRuleConflicts enrich
        const view = buildCommissionRuleConflictView(
            {
                code: 'COMMISSION_RULE_CONFLICT',
                conflicts: [
                    {
                        type: 'overlap',
                        ruleIds: ['41', '42'],
                        ruleNames: ['Services', 'Dept 20 services'],
                        priority: 1,
                        role: 'technician',
                        sharedItems: [
                            { type: 'service', id: '1', name: 'Oil Change Service' },
                            { type: 'service', id: '2', name: 'Gear Oil Change' },
                        ],
                        rules: [
                            {
                                id: '41',
                                name: 'Services',
                                status: 'active',
                                priority: 1,
                                employeeRole: 'Technician',
                                appliesTo: 'services',
                                commissionType: 'Percentage',
                                value: 20,
                                departments: [],
                                categories: [],
                                products: [],
                                services: [],
                                kmInterval: [],
                                branches: [],
                                employees: [],
                            },
                            {
                                id: '42',
                                name: 'Dept 20 services',
                                status: 'active',
                                priority: 1,
                                employeeRole: 'Technician',
                                appliesTo: 'services',
                                commissionType: 'Percentage',
                                value: 15,
                                departments: [{ id: '20', name: 'Oil Change' }],
                                categories: [],
                                products: [],
                                services: [],
                                kmInterval: [],
                                branches: [],
                                employees: [],
                            },
                        ],
                    },
                ],
                totalConflicts: 1,
            },
            t,
        );
        assert.equal(view.cards.length, 2);
        assert.equal(view.groups.length, 1);
        assert.equal(
            view.groups[0].heading,
            'Rules #41 and #42 conflict at priority 1 (All technicians)',
        );
        assert.equal(view.cards[0].name, 'Services');
        assert.equal(view.cards[0].id, '41');
        assert.equal(view.cards[1].name, 'Dept 20 services');
        assert.equal(view.cards[1].id, '42');
        assert.notEqual(view.cards[0].name, '—');
        assert.notEqual(view.cards[1].name, '—');
        assert.ok(view.cards[0].name.trim() !== '');
        assert.ok(view.cards[1].name.trim() !== '');
    });

    it('builds Arabic headings for two and three rules with و', () => {
        const two = groupHeadingForReportRow(
            { ruleIds: ['41', '42'], priority: 1 },
            'كل الفنيين',
            tAr,
        );
        assert.equal(two, 'القاعدتان #41 و #42 تتعارضان عند الأولوية 1 (كل الفنيين)');
        assert.ok(!two.includes(' and '));

        const three = groupHeadingForReportRow(
            { ruleIds: ['41', '42', '43'], priority: 2 },
            'كل الفنيين',
            tAr,
        );
        assert.equal(
            three,
            'القواعد #41، #42 و #43 تتعارض عند الأولوية 2 (كل الفنيين)',
        );
        assert.ok(three.includes(' و '));
        assert.ok(!three.includes(' and '));
    });

    it('labels KM in EN and كم in AR', () => {
        const enView = buildCommissionRuleConflictView(
            {
                code: 'COMMISSION_RULE_CONFLICT',
                conflicts: [
                    {
                        type: 'overlap',
                        rule: {
                            id: '1',
                            name: 'Oils',
                            priority: 1,
                            employeeRole: 'Technician',
                            kmInterval: [5000, 10000],
                        },
                        sharedItems: [],
                    },
                ],
                totalConflicts: 1,
            },
            t,
        );
        assert.equal(enView.cards[0].km, '5,000 KM, 10,000 KM');

        const arView = buildCommissionRuleConflictView(
            {
                code: 'COMMISSION_RULE_CONFLICT',
                conflicts: [
                    {
                        type: 'overlap',
                        rule: {
                            id: '1',
                            name: 'Oils',
                            priority: 1,
                            employeeRole: 'Technician',
                            kmInterval: [5000],
                        },
                        sharedItems: [],
                    },
                ],
                totalConflicts: 1,
            },
            tAr,
        );
        assert.equal(arView.cards[0].km, '5,000 كم');
        assert.ok(!arView.cards[0].km.includes('KM'));
    });

    it('never shows empty name when rules[] is present', () => {
        const view = buildCommissionRuleConflictView(
            {
                code: 'COMMISSION_RULE_CONFLICT',
                conflicts: [
                    {
                        type: 'duplicate_item',
                        ruleIds: ['9', '10'],
                        ruleNames: ['Alpha', 'Beta'],
                        priority: 2,
                        role: 'cashier',
                        sharedItems: [{ type: 'product', id: '1', name: 'Filter' }],
                        rules: [
                            {
                                id: '9',
                                name: 'Alpha',
                                status: 'active',
                                priority: 2,
                                employeeRole: 'cashier',
                                commissionType: 'Fixed',
                                value: 5,
                            },
                            {
                                id: '10',
                                name: 'Beta',
                                status: 'active',
                                priority: 2,
                                employeeRole: 'cashier',
                                commissionType: 'Fixed',
                                value: 7,
                            },
                        ],
                    },
                ],
                totalConflicts: 1,
            },
            t,
        );
        for (const card of view.cards) {
            assert.ok(card.name && card.name !== '—');
            assert.ok(card.id);
            assert.match(card.commission, /SAR/);
        }
        assert.equal(view.cards[0].role, 'Cashiers');
    });

    it('caps shown conflict rows and reports andMore from totalConflicts', () => {
        const conflicts = Array.from({ length: 12 }, (_, i) => ({
            type: 'overlap',
            rule: { id: String(i + 1), name: `Rule ${i + 1}`, priority: 1, employeeRole: 'Technician' },
            sharedItems: [],
        }));
        const view = buildCommissionRuleConflictView(
            { code: 'COMMISSION_RULE_CONFLICT', conflicts, totalConflicts: 15 },
            t,
        );
        assert.equal(view.cards.length, 10);
        assert.equal(view.andMore, 5);
    });

    it('shows empty scope fields as All', () => {
        const view = buildCommissionRuleConflictView(
            {
                code: 'COMMISSION_RULE_CONFLICT',
                conflicts: [
                    {
                        type: 'overlap',
                        rule: {
                            id: '9',
                            name: 'Wide',
                            priority: 1,
                            employeeRole: 'Technician',
                            departments: [],
                            categories: [],
                            products: [],
                            services: [],
                            kmInterval: [],
                            branches: [],
                            employees: [],
                        },
                        sharedItems: [],
                    },
                ],
                totalConflicts: 1,
            },
            t,
        );
        assert.equal(view.cards[0].departments, 'All');
        assert.equal(view.cards[0].products, 'All');
        assert.equal(view.cards[0].branches, 'All');
        assert.equal(view.cards[0].employees, 'All');
    });

    it('falls back to the generic message for unknown errors', () => {
        const view = buildCommissionRuleConflictView(
            { code: 'OTHER', message: 'nope' },
            t,
        );
        assert.equal(view.isConflict, false);
        assert.equal(view.message, 'nope');
        assert.equal(view.cards.length, 0);

        const empty = buildCommissionRuleConflictView(null, t);
        assert.equal(empty.isConflict, false);
        assert.equal(empty.message, 'Something went wrong, please try again.');
    });
});
