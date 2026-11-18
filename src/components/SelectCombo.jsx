import React, { useMemo } from 'react';
import SearchSelect from './SearchSelect';

function textOf(node) {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (React.isValidElement(node)) return textOf(node.props.children);
    return '';
}

function collectOptions(children, group, out) {
    React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) return;
        if (child.type === 'option') {
            const label = textOf(child.props.children).trim();
            const value = child.props.value ?? label;
            out.push({
                value: String(value),
                label,
                hint: group || undefined,
                disabled: Boolean(child.props.disabled),
                placeholder: String(value) === '' || undefined,
            });
        } else if (child.type === 'optgroup') {
            collectOptions(child.props.children, child.props.label, out);
        } else if (child.type === React.Fragment) {
            collectOptions(child.props.children, group, out);
        }
    });
    return out;
}

const LAYOUT_STYLE_KEYS = [
    'width', 'minWidth', 'maxWidth', 'flex', 'flexBasis', 'flexGrow', 'flexShrink',
    'gridColumn', 'alignSelf', 'justifySelf',
    'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginInlineStart', 'marginInlineEnd',
];

/**
 * Searchable stand-in for a native `<select>`: takes the same `<option>` / `<optgroup>` children and
 * calls `onChange` with a select-like event (`e.target.value`, `e.target.name`). Disabled options stay
 * visible but unpickable; an option with `value=""` shows as a greyed placeholder when selected.
 */
export default function SelectCombo({
    children,
    value,
    defaultValue,
    onChange,
    name,
    id,
    disabled,
    required,
    title,
    style,
    size = 'md',
    placeholder,
    menuMinWidth,
    className = '',
    'aria-label': ariaLabel,
}) {
    const options = useMemo(() => collectOptions(children, '', []), [children]);
    const current = value ?? defaultValue ?? '';
    const comboClass = className.split(/\s+/).filter((c) => c.startsWith('ss-')).join(' ');
    const layoutStyle = useMemo(() => {
        if (!style) return undefined;
        const out = {};
        for (const k of LAYOUT_STYLE_KEYS) if (style[k] != null) out[k] = style[k];
        return out;
    }, [style]);

    const handleChange = (next) => {
        if (!onChange) return;
        const target = { value: String(next ?? ''), name, id, type: 'select-one' };
        onChange({
            target,
            currentTarget: target,
            preventDefault() {},
            stopPropagation() {},
        });
    };

    return (
        <SearchSelect
            options={options}
            value={current}
            onChange={handleChange}
            id={id}
            name={name}
            disabled={disabled}
            required={required}
            title={title}
            ariaLabel={ariaLabel}
            size={size}
            placeholder={placeholder}
            menuMinWidth={menuMinWidth}
            className={comboClass}
            style={layoutStyle}
        />
    );
}
