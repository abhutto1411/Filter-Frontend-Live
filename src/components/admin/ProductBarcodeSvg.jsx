import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function ProductBarcodeSvg({ value, height = 44 }) {
    const svgRef = useRef(null);
    const code = value != null ? String(value).trim() : '';

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg || !code) return;
        const isEan13 = /^\d{13}$/.test(code);
        try {
            JsBarcode(svg, code, {
                format: isEan13 ? 'EAN13' : 'CODE128',
                displayValue: false,
                margin: 0,
                height,
                width: isEan13 ? 1.6 : 1.35,
                background: 'transparent',
            });
        } catch {
            svg.replaceChildren();
        }
    }, [code, height]);

    if (!code) return <span className="mc-muted">—</span>;
    return <svg ref={svgRef} className="mc-barcode-svg" role="img" aria-label={code} />;
}
