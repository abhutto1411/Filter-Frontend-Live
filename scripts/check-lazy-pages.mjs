/**
 * Fail the build when a lazily routed page has no `export default`,
 * or when a page module participates in a circular import.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src');
const PAGE_EXTS = ['.js', '.jsx', '.ts', '.tsx'];

export function hasDefaultExport(source) {
    const s = String(source || '');
    if (/export\s+default\s+/.test(s)) return true;
    if (/export\s*\{[^}]*\bdefault\b/.test(s)) return true;
    return false;
}

export function listNonComponentNamedExports(source) {
    const names = [];
    const re = /^export\s+(?:const|let|var|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/gm;
    let m;
    while ((m = re.exec(source))) {
        names.push(m[1]);
    }
    const brace = /export\s*\{([^}]+)\}/g;
    let b;
    while ((b = brace.exec(source))) {
        for (const part of b[1].split(',')) {
            const bit = part.trim();
            if (!bit || /\bas\s+default\b/.test(bit)) continue;
            const name = bit.split(/\s+as\s+/).pop().trim();
            if (name && name !== 'default') names.push(name);
        }
    }
    return [...new Set(names)].filter((n) => {
        // PascalCase React components are allowed as extra named exports.
        if (/^[A-Z][a-z]/.test(n)) return false;
        return true;
    });
}

export function findLazyImportSpecs(source) {
    const specs = [];
    const re =
        /(?:lazyPage|lazyWithRetry|loadPage|lazy)\(\s*(?:\(\)\s*=>\s*)?import\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(source))) specs.push(m[1]);
    return specs;
}

function walk(dir, acc = []) {
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === 'dist') continue;
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) walk(full, acc);
        else if (PAGE_EXTS.includes(extname(name))) acc.push(full);
    }
    return acc;
}

function resolveImport(fromFile, spec) {
    if (!spec.startsWith('.')) return null;
    const base = resolve(dirname(fromFile), spec);
    if (existsSync(base) && statSync(base).isFile()) return base;
    for (const ext of PAGE_EXTS) {
        if (existsSync(base + ext)) return base + ext;
    }
    if (existsSync(base) && statSync(base).isDirectory()) {
        for (const idx of ['index.jsx', 'index.js', 'index.tsx', 'index.ts']) {
            const p = join(base, idx);
            if (existsSync(p)) return p;
        }
    }
    return null;
}

function localImports(fromFile, source) {
    const out = [];
    const re = /(?:import|export)\s+[^'"]*?from\s*['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(source))) {
        const resolved = resolveImport(fromFile, m[1]);
        if (resolved) out.push(resolved);
    }
    return out;
}

export function collectLazyTargets(srcRoot = SRC) {
    const files = walk(srcRoot);
    const targets = new Map();
    for (const file of files) {
        const source = readFileSync(file, 'utf8');
        for (const spec of findLazyImportSpecs(source)) {
            const resolved = resolveImport(file, spec);
            if (!resolved) {
                targets.set(`${file}::${spec}`, { file: null, spec, from: file, missing: true });
                continue;
            }
            targets.set(resolved, { file: resolved, spec, from: file, missing: false });
        }
    }
    return [...targets.values()];
}

function findCycle(start, graph) {
    const stack = [];
    const onStack = new Set();
    const seen = new Set();
    const dfs = (node) => {
        if (onStack.has(node)) {
            const i = stack.indexOf(node);
            return stack.slice(i).concat(node);
        }
        if (seen.has(node)) return null;
        seen.add(node);
        onStack.add(node);
        stack.push(node);
        for (const next of graph.get(node) || []) {
            const hit = dfs(next);
            if (hit) return hit;
        }
        stack.pop();
        onStack.delete(node);
        return null;
    };
    return dfs(start);
}

export function findPageCycles(pageFiles, srcRoot = SRC) {
    const all = walk(srcRoot);
    const graph = new Map();
    const sources = new Map();
    for (const file of all) {
        const source = readFileSync(file, 'utf8');
        sources.set(file, source);
        graph.set(file, localImports(file, source));
    }
    const cycles = [];
    const seenKey = new Set();
    for (const page of pageFiles) {
        const cycle = findCycle(page, graph);
        if (!cycle || cycle.length < 2) continue;
        if (!cycle.includes(page)) continue;
        const key = cycle.slice(0, -1).sort().join('|');
        if (seenKey.has(key)) continue;
        seenKey.add(key);
        cycles.push(cycle.map((f) => relative(srcRoot, f).replace(/\\/g, '/')));
    }
    return cycles;
}

export function auditLazyPages(srcRoot = SRC, extraFiles = []) {
    const errors = [];
    const targets = collectLazyTargets(srcRoot);
    for (const extra of extraFiles) {
        targets.push({ file: extra, spec: extra, from: 'fixture', missing: false });
    }
    const pageFiles = [];
    for (const t of targets) {
        if (t.missing || !t.file) {
            errors.push(`unresolved lazy import ${t.spec} from ${t.from}`);
            continue;
        }
        pageFiles.push(t.file);
        const source = readFileSync(t.file, 'utf8');
        if (!hasDefaultExport(source)) {
            errors.push(`no default export: ${relative(srcRoot, t.file).replace(/\\/g, '/')}`);
        }
    }
    const cycles = findPageCycles(pageFiles, srcRoot);
    for (const c of cycles) {
        errors.push(`circular import: ${c.join(' -> ')}`);
    }
    return { errors, targets, cycles };
}

function main() {
    const extra = process.argv.slice(2).filter((a) => a !== '--');
    const result = auditLazyPages(SRC, extra);
    if (result.errors.length) {
        for (const e of result.errors) console.error(`check-lazy-pages: ${e}`);
        process.exit(1);
    }
    console.log(`check-lazy-pages: ${result.targets.length} lazy page(s) have a default export`);
}

const isMain =
    process.argv[1] &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) main();
