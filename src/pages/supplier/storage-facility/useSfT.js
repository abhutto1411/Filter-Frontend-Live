import { useCallback } from 'react';
import { useDocumentLang } from '../../../hooks/useDocumentLang';
import { sfT } from '../../../utils/storageFacilityI18n';

/**
 * Translator for the storage-facility screens.
 *
 * These screens render in two portals that hand the locale down differently:
 * the supplier portal passes a `locale` prop, the admin portal puts it on the
 * router outlet, and leaf components inside modals get neither. `<html lang>`
 * is the one thing both layouts set, and reading it through `useDocumentLang`
 * re-renders on a language switch — which a localStorage read would not.
 */
export function useSfT() {
    const lang = useDocumentLang();
    return useCallback((key, vars) => sfT(lang, key, vars), [lang]);
}
