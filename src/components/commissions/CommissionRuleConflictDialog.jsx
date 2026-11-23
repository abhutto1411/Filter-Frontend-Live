import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { buildCommissionRuleConflictView } from './commissionRuleConflictView';

const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible conflict dialog for COMMISSION_RULE_CONFLICT.
 * Esc closes; Tab cycles inside; focus returns to `returnFocusRef` on close.
 */
export default function CommissionRuleConflictDialog({
    err,
    t,
    onClose,
    onEditRule,
    returnFocusRef,
    /** When true, this is the list "Check conflicts" report (not a blocked save). */
    reportMode = false,
    /** Disable "Edit existing rule" while a fetch/open is in flight. */
    editBusy = false,
    /** Shown inside the dialog when opening an existing rule fails. */
    editError = '',
}) {
    const view = buildCommissionRuleConflictView(err, t);
    const title = reportMode ? t('rules.conflicts.title') : view.title;
    const message = reportMode
        ? view.cards.length
            ? t('rules.conflict.body')
            : t('rules.conflicts.none')
        : view.message;
    const titleId = useId();
    const dialogRef = useRef(null);
    const closeBtnRef = useRef(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    // Focus trap + initial focus only when the dialog mounts (not on parent re-renders).
    useEffect(() => {
        const restoreTarget = returnFocusRef?.current || document.activeElement;
        const root = dialogRef.current;
        const focusables = () =>
            root ? Array.from(root.querySelectorAll(FOCUSABLE)) : [];

        const initial = closeBtnRef.current || focusables()[0] || root;
        initial?.focus?.();

        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCloseRef.current?.();
                return;
            }
            if (e.key !== 'Tab' || !root) return;
            const list = focusables();
            if (list.length === 0) {
                e.preventDefault();
                root.focus();
                return;
            }
            const first = list[0];
            const last = list[list.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first || !root.contains(document.activeElement)) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            if (restoreTarget && typeof restoreTarget.focus === 'function') {
                try {
                    restoreTarget.focus();
                } catch {
                    /* ignore */
                }
            }
        };
        // Mount-only: dialog unmounts on close; parent re-renders must not steal focus.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only trap
    }, []);

    if (typeof document === 'undefined') return null;

    const canEdit = typeof onEditRule === 'function' && view.cards.some((c) => c.id);
    const groups = Array.isArray(view.groups) && view.groups.length
        ? view.groups
        : [{ heading: null, cards: view.cards }];

    const node = (
        <div
            className="app-modal-overlay wcr-conflict-dialog-overlay"
            role="presentation"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                className="app-modal-content wcr-conflict-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="app-modal-header">
                    <h3 id={titleId}>{title}</h3>
                    <button
                        type="button"
                        className="app-modal-close-btn"
                        onClick={onClose}
                        aria-label={t('rules.conflict.close')}
                        ref={closeBtnRef}
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="app-modal-body wcr-conflict-dialog__body">
                    <p className="wcr-conflict-dialog__message">{message}</p>
                    {editError ? (
                        <div className="wcr-error wcr-conflict-dialog__edit-error" role="alert">
                            {editError}
                        </div>
                    ) : null}
                    {groups.map((group, gi) => (
                        <div key={group.heading || `g-${gi}`} className="wcr-conflict-group">
                            {group.heading ? (
                                <h4 className="wcr-conflict-group__heading">{group.heading}</h4>
                            ) : null}
                            <ul className="wcr-conflict-cards">
                                {(group.cards || []).map((card) => (
                                    <li
                                        key={card.id || card.name}
                                        className="wcr-conflict-card"
                                    >
                                        <div className="wcr-conflict-card__head">
                                            <strong>{card.name}</strong>
                                            {card.id ? (
                                                <span className="wcr-hint">#{card.id}</span>
                                            ) : null}
                                        </div>
                                        <p className="wcr-conflict-card__highlight">
                                            {card.highlight}
                                        </p>
                                        <dl className="wcr-conflict-card__meta">
                                            <div>
                                                <dt>{t('rules.conflict.field.status')}</dt>
                                                <dd>{card.status}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.priority')}</dt>
                                                <dd>{card.priority}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.role')}</dt>
                                                <dd>{card.role}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.appliesTo')}</dt>
                                                <dd>{card.appliesTo}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.commission')}</dt>
                                                <dd>{card.commission}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.dates')}</dt>
                                                <dd>
                                                    {card.effectiveFrom} → {card.effectiveTo}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.departments')}</dt>
                                                <dd>{card.departments}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.categories')}</dt>
                                                <dd>{card.categories}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.products')}</dt>
                                                <dd>{card.products}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.services')}</dt>
                                                <dd>{card.services}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.km')}</dt>
                                                <dd>{card.km}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.branches')}</dt>
                                                <dd>{card.branches}</dd>
                                            </div>
                                            <div>
                                                <dt>{t('rules.conflict.field.employees')}</dt>
                                                <dd>{card.employees}</dd>
                                            </div>
                                        </dl>
                                        {canEdit && card.id ? (
                                            <button
                                                type="button"
                                                className="ws-btn ws-btn--secondary wcr-conflict-card__edit"
                                                disabled={editBusy}
                                                onClick={() => onEditRule(card.id)}
                                            >
                                                {t('rules.conflict.editExisting')}
                                            </button>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    {view.andMore > 0 ? (
                        <p className="wcr-hint">
                            {t('rules.conflict.andMore', { count: view.andMore })}
                        </p>
                    ) : null}
                    {view.howToFix ? (
                        <p className="wcr-conflict-dialog__howto">{view.howToFix}</p>
                    ) : null}
                </div>
                <div className="app-modal-footer">
                    <button type="button" className="ws-btn ws-btn--primary" onClick={onClose}>
                        {t('rules.conflict.close')}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(node, document.body);
}
