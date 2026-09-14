/* Undo any app-level print rules copied in from <head> (some pages blank out
   `body *` and reveal only their own root), then normalise the page box. */
const BASE_PRINT_CSS = `
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; height: auto !important; }
  body, body * {
    visibility: visible !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body > * { display: block !important; }
  @page { size: A4; margin: 10mm; }
`;

/**
 * Print a single DOM node in isolation, without depending on app-wide
 * `@media print` overrides.
 *
 * The older approach — call `window.print()` and hide the rest of the app with
 * `@media print` rules — only works when every stylesheet currently loaded
 * agrees. Portals that mount outside the POS bundle (e.g. the corporate billing
 * invoice modal) load a different CSS set, so the page-level rules that make the
 * invoice printable are missing and the browser prints a blank sheet.
 *
 * Instead we clone the node into an off-screen same-origin iframe, copy the
 * document's stylesheets into it, and print that document. The iframe body
 * contains nothing but the node, so nothing has to be hidden.
 *
 * @param {HTMLElement} node        node to print (cloned, never mutated)
 * @param {object}      [opts]
 * @param {string}      [opts.title] document title (browsers use it as the default filename in "Save as PDF")
 * @param {string}      [opts.css]   extra CSS appended last, so it beats copied rules
 * @returns {Promise<boolean>} false when printing could not be set up (caller may fall back)
 */
export async function printNode(node, { title = document.title, css = '' } = {}) {
    if (!node || typeof document === 'undefined') return false;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    // Off-screen rather than display:none — a hidden iframe does not lay out,
    // and some browsers then print an empty document.
    iframe.style.cssText =
        'position:fixed;left:-10000px;top:0;width:1024px;height:1200px;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);

    const cleanup = () => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    try {
        const frameWin = iframe.contentWindow;
        const doc = frameWin?.document;
        if (!doc) {
            cleanup();
            return false;
        }

        // Only <head> styles: the page's <body> may hold scoped <style> blocks
        // (the invoice modal's own print rules, for one) that assume the app's
        // DOM shape and would hide our clone.
        const headStyles = Array.from(
            document.head.querySelectorAll('style, link[rel="stylesheet"]'),
        )
            .map((el) => el.outerHTML)
            .join('\n');

        doc.open();
        doc.write(
            `<!DOCTYPE html><html><head><meta charset="utf-8">` +
                `<title>${String(title).replace(/[<>]/g, '')}</title>` +
                `${headStyles}` +
                `<style>${BASE_PRINT_CSS}${css}</style>` +
                `</head><body></body></html>`,
        );
        doc.close();

        doc.body.appendChild(doc.importNode(node, true));

        await waitForAssets(doc);

        frameWin.focus();
        frameWin.print();

        // Chrome blocks on print(); Safari/Firefox return immediately, so keep
        // the iframe around until afterprint (with a hard fallback).
        frameWin.addEventListener?.('afterprint', cleanup, { once: true });
        window.setTimeout(cleanup, 60000);
        return true;
    } catch {
        cleanup();
        return false;
    }
}

/** Resolve once images, stylesheets and fonts are ready — or after 3s. */
function waitForAssets(doc) {
    const ready = (async () => {
        const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
        await Promise.all(links.map((el) => (el.sheet ? null : settleOn(el))));

        const imgs = Array.from(doc.images);
        await Promise.all(imgs.map((img) => (img.complete ? null : settleOn(img))));

        try {
            await doc.fonts?.ready;
        } catch {
            /* fonts API unavailable — printing with fallbacks is fine */
        }
    })();

    return Promise.race([ready, new Promise((res) => setTimeout(res, 3000))]);
}

function settleOn(el) {
    return new Promise((resolve) => {
        const done = () => {
            el.removeEventListener('load', done);
            el.removeEventListener('error', done);
            resolve();
        };
        el.addEventListener('load', done);
        el.addEventListener('error', done);
    });
}
