import React, { useMemo } from 'react';
import { LockerPortalContext, buildLockerPortalValue } from './useLockerPortal';

export function LockerPortalProvider({ locale, can, canOpenTab, embedded, children }) {
    const value = useMemo(
        () => buildLockerPortalValue({ locale, can, canOpenTab, embedded }),
        [locale, can, canOpenTab, embedded],
    );
    return <LockerPortalContext.Provider value={value}>{children}</LockerPortalContext.Provider>;
}
