import RiyalIcon from './RiyalIcon';
import { formatMoney2 } from '../utils/formatMoney2';

/** Shared amount with the SAMA ⃁ symbol (RiyalIcon). */
export default function Money({ amount, size = 14, className = '' }) {
    return (
        <span
            className={className}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
        >
            <RiyalIcon size={size} />
            <bdi dir="ltr">{formatMoney2(amount)}</bdi>
        </span>
    );
}
