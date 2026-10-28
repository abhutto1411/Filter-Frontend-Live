/**
 * Pure view-model for the commission-rule conflict dialog (save blocked)
 * and the list "Check conflicts" report.
 */

const MAX_SHOWN = 10;

function namedList(rows, allLabel, t) {
    if (!Array.isArray(rows) || rows.length === 0) return allLabel;
    const sep = typeof t === 'function' ? t('rules.conflict.listSep') : ', ';
    return rows
        .map((r) => (r && typeof r === 'object' ? String(r.name || r.id || '').trim() : String(r || '').trim()))
        .filter(Boolean)
        .join(sep);
}

function kmLabel(kmInterval, allLabel, t) {
    if (!Array.isArray(kmInterval) || kmInterval.length === 0) return allLabel;
    return kmInterval
        .map((n) => t('rules.scope.km', { km: Number(n).toLocaleString('en-US') }))
        .join(t('rules.conflict.listSep'));
}

/** Join "#41", "#42" with a localized "and" / "و" (and commas for 3+). */
export function formatConflictRuleIdList(ids, t) {
    const list = (Array.isArray(ids) ? ids : []).filter(Boolean);
    if (list.length === 0) return '—';
    if (list.length === 1) return list[0];
    if (list.length === 2) {
        return t('rules.conflict.listPair', { a: list[0], b: list[1] });
    }
    const sep = t('rules.conflict.listSep');
    const and = t('rules.conflict.listAnd');
    return `${list.slice(0, -1).join(sep)}${and}${list[list.length - 1]}`;
}

function translateOrRaw(t, key, raw) {
    const labeled = t(key);
    return labeled !== key ? labeled : raw;
}

/** Role labels from workshopCommissionsI18n (`rules.role.*`). */
export function labelConflictRole(raw, t) {
    const role = String(raw || '').trim();
    if (!role) return '—';
    const lower = role.toLowerCase();
    const candidates = [
        `rules.role.${role}`,
        lower === 'technician' ? 'rules.role.Technician' : `rules.role.${lower}`,
    ];
    for (const key of candidates) {
        const labeled = t(key);
        if (labeled !== key) return labeled;
    }
    return role;
}

export function labelConflictStatus(raw, t) {
    const status = String(raw || '').trim();
    if (!status) return '—';
    const key = `rules.status.${status.toLowerCase()}`;
    return translateOrRaw(t, key, status);
}

export function labelConflictAppliesTo(raw, t) {
    const applies = String(raw || 'all').trim().toLowerCase() || 'all';
    const key = `rules.appliesTo.${applies}`;
    return translateOrRaw(t, key, raw || 'all');
}

/** Percentage → "60%"; Fixed → money.sar; profile → profile label. */
export function formatConflictCommission(rule, t) {
    const type = String(rule?.commissionType || '').trim();
    const lc = type.toLowerCase();
    const val = rule?.value;
    if (rule?.useProfilePercent || lc.includes('profile')) {
        return {
            commissionType: t('rules.rate.profile'),
            value: '',
            commission: t('rules.rate.profile'),
        };
    }
    if (lc === 'fixed' || lc === 'fixedamount') {
        const amount = Number(val || 0).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
        const money = t('money.sar', { amount });
        return {
            commissionType: t('rules.conflict.commission.fixed'),
            value: money,
            commission: `${t('rules.conflict.commission.fixed')} ${money}`.trim(),
        };
    }
    if (!type || lc === 'percentage' || lc === 'percent') {
        const pct = `${Number(val || 0)}%`;
        return {
            commissionType: t('rules.conflict.commission.percentage'),
            value: pct,
            commission: `${t('rules.conflict.commission.percentage')} ${pct}`.trim(),
        };
    }
    const fallbackVal = val != null && val !== '' ? String(val) : '';
    return {
        commissionType: type,
        value: fallbackVal,
        commission: `${type}${fallbackVal ? ` ${fallbackVal}` : ''}`.trim() || '—',
    };
}

function cardFromRule(rule, sharedItems, type, t, allLabel) {
    const id = String(rule?.id ?? '').trim();
    const name = String(rule?.name ?? '').trim() || id || '—';
    const shared = Array.isArray(sharedItems) ? sharedItems : [];
    const sharedNames = shared
        .map((item) => String(item?.name || item?.id || '').trim())
        .filter(Boolean);
    const priority = rule?.priority != null ? String(rule.priority) : '—';
    const roleRaw = String(rule?.employeeRole || '').trim() || '—';
    const role = labelConflictRole(roleRaw === '—' ? '' : roleRaw, t);
    const highlight = t('rules.conflict.highlight', {
        priority,
        role,
        items: sharedNames.length ? sharedNames.join(', ') : t('rules.conflict.sharedScope'),
    });
    const commission = formatConflictCommission(rule || {}, t);
    const kmSource = Array.isArray(rule?.kmInterval)
        ? rule.kmInterval
        : Array.isArray(rule?.kmValues)
          ? rule.kmValues
          : [];

    return {
        type: type === 'duplicate_item' ? 'duplicate_item' : 'overlap',
        id,
        name,
        status: labelConflictStatus(rule?.status, t),
        priority,
        role,
        appliesTo: labelConflictAppliesTo(rule?.appliesTo, t),
        commissionType: commission.commissionType,
        value: commission.value,
        commission: commission.commission,
        effectiveFrom: rule?.effectiveFrom
            ? String(rule.effectiveFrom)
            : t('rules.conflict.openDate'),
        effectiveTo: rule?.effectiveTo ? String(rule.effectiveTo) : t('rules.conflict.openDate'),
        departments: namedList(rule?.departments, allLabel, t),
        categories: namedList(rule?.categories, allLabel, t),
        products: namedList(rule?.products, allLabel, t),
        services: namedList(rule?.services, allLabel, t),
        km: kmLabel(kmSource, allLabel, t),
        branches: namedList(rule?.branches, allLabel, t),
        employees: namedList(rule?.employees, allLabel, t),
        sharedItems: shared,
        highlight,
    };
}

export function groupHeadingForReportRow(row, roleLabel, t) {
    const ids = Array.isArray(row?.ruleIds)
        ? row.ruleIds.map((id) => `#${id}`).filter((s) => s !== '#')
        : [];
    const fromRules = Array.isArray(row?.rules)
        ? row.rules.map((r) => (r?.id != null ? `#${r.id}` : '')).filter(Boolean)
        : [];
    const idMarks = ids.length ? ids : fromRules;
    const priority = row?.priority != null ? String(row.priority) : '—';
    if (idMarks.length === 2) {
        return t('rules.conflict.heading.two', {
            a: idMarks[0],
            b: idMarks[1],
            p: priority,
            role: roleLabel,
        });
    }
    return t('rules.conflict.heading.many', {
        list: formatConflictRuleIdList(idMarks, t),
        p: priority,
        role: roleLabel,
    });
}

/** Normalize one backend conflict row (save `rule` or report `rules[]`) into a group. */
function groupFromConflictRow(c, t, allLabel) {
    const type = c?.type === 'duplicate_item' ? 'duplicate_item' : 'overlap';
    const sharedItems = Array.isArray(c?.sharedItems) ? c.sharedItems : [];

    if (Array.isArray(c?.rules) && c.rules.length > 0) {
        const roleRaw = String(c.role || c.rules[0]?.employeeRole || '').trim();
        const roleLabel = labelConflictRole(roleRaw, t);
        return {
            heading: groupHeadingForReportRow(c, roleLabel, t),
            cards: c.rules.map((rule) => cardFromRule(rule, sharedItems, type, t, allLabel)),
        };
    }

    const rule = c?.rule && typeof c.rule === 'object' ? c.rule : {};
    return {
        heading: null,
        cards: [cardFromRule(rule, sharedItems, type, t, allLabel)],
    };
}

/**
 * @param {unknown} err
 * @param {(key: string, vars?: Record<string, string|number>) => string} t
 */
export function buildCommissionRuleConflictView(err, t) {
    const translate = typeof t === 'function' ? t : (key) => key;
    const allLabel = translate('rules.conflict.all');
    const code = err && typeof err === 'object' ? String(err.code || '') : '';

    if (code !== 'COMMISSION_RULE_CONFLICT') {
        return {
            isConflict: false,
            title: translate('rules.conflict.title'),
            message: (err && err.message) || translate('rules.err.generic'),
            groups: [],
            cards: [],
            andMore: 0,
            howToFix: '',
        };
    }

    const conflicts = Array.isArray(err.conflicts) ? err.conflicts : [];
    const total =
        typeof err.totalConflicts === 'number' && Number.isFinite(err.totalConflicts)
            ? err.totalConflicts
            : conflicts.length;
    const shown = conflicts.slice(0, MAX_SHOWN);
    const andMore = Math.max(0, total - shown.length);

    const groups = shown.map((c) => groupFromConflictRow(c, translate, allLabel));
    const cards = groups.flatMap((g) => g.cards);

    const primary = cards[0];
    const message = primary
        ? translate('rules.conflict.message', { name: primary.name, id: primary.id || '—' })
        : translate('rules.conflict.body');

    return {
        isConflict: true,
        title: translate('rules.conflict.title'),
        message,
        groups,
        cards,
        andMore,
        howToFix: translate('rules.conflict.howToFix'),
    };
}
