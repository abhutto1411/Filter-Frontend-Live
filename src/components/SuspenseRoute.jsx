import React, { Suspense } from 'react';
import { PageLoadingFallback } from './PageLoadingFallback';

/**
 * Wrap a lazy-loaded route component with Suspense fallback
 * Usage: <SuspenseRoute component={LazyCom ponent} />
 */
export function SuspenseRoute({ component: Component }) {
    return (
        <Suspense fallback={<PageLoadingFallback />}>
            <Component />
        </Suspense>
    );
}
