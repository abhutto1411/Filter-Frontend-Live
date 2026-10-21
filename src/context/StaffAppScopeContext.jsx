import React, { useCallback, useContext, useMemo } from 'react';
import { createStableContext } from '../utils/stableContext';

const StaffAppScopeContext = createStableContext('staff-app-scope', {
  workshopId: null,
  scopeParams: () => ({}),
  locale: null,
});

export function StaffAppScopeProvider({ workshopId, locale = null, children }) {
  const scopeParams = useCallback(() => {
    if (!workshopId) return {};
    return { workshopId: String(workshopId) };
  }, [workshopId]);

  const value = useMemo(
    () => ({
      workshopId: workshopId ? String(workshopId) : null,
      scopeParams,
      locale,
    }),
    [workshopId, scopeParams, locale],
  );

  return (
    <StaffAppScopeContext.Provider value={value}>
      {children}
    </StaffAppScopeContext.Provider>
  );
}

export function useStaffAppScope() {
  return useContext(StaffAppScopeContext);
}

/** Merge branch + optional super-admin workshop scope into API query params. */
export function staffAppQueryParams(branchParams = {}, scope) {
  const ctx = scope ?? {};
  const workshopParams =
    typeof ctx.scopeParams === 'function' ? ctx.scopeParams() : {};
  return { ...branchParams, ...workshopParams };
}
