import React from 'react';
import RiyalIcon from '../components/RiyalIcon';

let cache = new Map();

/** CLOSING F2: static SVG markup of the shared RiyalIcon for print HTML. */
export async function riyalPrintSvg(size = 10) {
    if (cache.has(size)) return cache.get(size);
    const { renderToStaticMarkup } = await import('react-dom/server');
    const svg = renderToStaticMarkup(React.createElement(RiyalIcon, { size }));
    cache.set(size, svg);
    return svg;
}
