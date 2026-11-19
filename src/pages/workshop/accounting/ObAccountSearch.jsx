import React, { useMemo } from 'react';
import WsSearchSuggest from '../../../components/workshop/WsSearchSuggest';
import { rankObAccountSuggestions } from '../../../utils/openingBalanceDisplay';

/**
 * Opening-balance COA combobox — wraps WsSearchSuggest (↑/↓ Enter Esc).
 */
export default function ObAccountSearch({
  accounts,
  value,
  onChange,
  onPick,
  onClear,
  locale = 'en',
  placeholder,
  emptyText,
  hint,
}) {
  const matches = useMemo(
    () => rankObAccountSuggestions(accounts, value, locale),
    [accounts, value, locale],
  );

  return (
    <WsSearchSuggest
      className="ob-account-search"
      value={value}
      onChange={onChange}
      matches={matches}
      getKey={(a) => String(a.accountId)}
      getLabel={(a) => (
        <>
          <code style={{ marginInlineEnd: 6 }}>{a.code}</code>
          {a.name}
        </>
      )}
      getMeta={(a) => {
        const typ = String(a.type || '');
        return typ ? typ : undefined;
      }}
      onPick={onPick}
      onClear={onClear}
      placeholder={placeholder}
      emptyText={emptyText}
      hint={hint}
      maxShown={20}
      picked={false}
    />
  );
}
