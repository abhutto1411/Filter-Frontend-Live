import { useEffect, useState } from 'react';

/**
 * Trails `value` by `delay` ms. Use it to keep a search box responsive while
 * the request it drives waits for the typing to stop.
 */
export default function useDebouncedValue(value, delay = 300) {
    const [settled, setSettled] = useState(value);

    useEffect(() => {
        const id = setTimeout(() => setSettled(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);

    return settled;
}
