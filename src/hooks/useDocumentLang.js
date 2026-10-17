import { useSyncExternalStore } from 'react';

function subscribe(onChange) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
    return () => observer.disconnect();
}

const getSnapshot = () => (document.documentElement.lang === 'ar' ? 'ar' : 'en');
const getServerSnapshot = () => 'en';

/** Portal UI language ('en' | 'ar'), kept in sync with the `<html lang>` the layouts set. */
export function useDocumentLang() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
