#!/usr/bin/env node
// Renders the CDN landing page (cdn/index.html) with the list of versions that are actually on the CDN.
// Runs in the production deploy (release.yml) after the bundles were uploaded.
//
//   node cdn/render-index.mjs --listing listing.json --releases releases.json --current 1.17.0 --out index.html
//
// --listing   JSON array from the Bunny Storage API (GET /<zone>/dist/): ObjectName, Length, DateCreated, ...
// --releases  JSON array from `gh release list --json tagName,publishedAt` (dates and release notes links)
// --current   the version DianaWidget.bundle.js now serves
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const REPO = 'https://github.com/zuugle-services/DianaWidget';
const PINNED = /^DianaWidget\.bundle-(\d+)\.(\d+)\.(\d+)\.js$/;

const SHOWN = 8; // newest versions visible before "show all"
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "27 Nov 2026" in Vienna time.
const formatDate = (iso) => {
    const [y, m, d] = new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' }).split('-');
    return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
};

// Bunny's timestamps carry no zone but are UTC.
const storageDate = (s) => (s && !/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? `${s}Z` : s);

export function renderIndex({ template, listing, releases, current, now = new Date() }) {
    const published = new Map(releases.map((r) => [r.tagName, r.publishedAt]));
    const versions = listing
        .filter((o) => !o.IsDirectory)
        .map((o) => ({ m: PINNED.exec(o.ObjectName), o }))
        .filter(({ m }) => m)
        .map(({ m, o }) => ({
            version: `${m[1]}.${m[2]}.${m[3]}`,
            parts: [Number(m[1]), Number(m[2]), Number(m[3])],
            file: o.ObjectName,
            size: o.Length,
            date: published.get(`v${m[1]}.${m[2]}.${m[3]}`) ?? storageDate(o.DateCreated),
            hasRelease: published.has(`v${m[1]}.${m[2]}.${m[3]}`),
        }))
        .sort((a, b) => b.parts[0] - a.parts[0] || b.parts[1] - a.parts[1] || b.parts[2] - a.parts[2]);

    if (!/^\d+\.\d+\.\d+$/.test(current)) throw new Error(`invalid --current: ${current}`);
    if (!versions.some((v) => v.version === current)) {
        throw new Error(`DianaWidget.bundle-${current}.js is not in the storage listing`);
    }

    const rows = versions.map((v, i) => {
        const badge = v.version === current ? '<span class="badge">current</span>' : '';
        const notes = v.hasRelease ? `<a href="${REPO}/releases/tag/v${v.version}">notes</a>` : '';
        return [
            i < SHOWN || v.version === current ? '          <tr>' : '          <tr class="more">',
            `<td class="v"><a href="dist/${v.file}">${v.version}</a>${badge}</td>`,
            `<td class="num">${v.date ? formatDate(v.date) : ''}</td>`,
            `<td class="num hide-s">${Math.round(v.size / 1000)} kB</td>`,
            `<td class="links hide-s"><a href="dist/${v.file}" download>file</a>${notes}</td>`,
            '</tr>',
        ].join('');
    });

    const out = template
        .replace('<!-- VERSIONS -->', rows.join('\n'))
        .replaceAll('{{CURRENT}}', current)
        .replaceAll('{{COUNT}}', String(versions.length))
        .replaceAll('{{UPDATED}}', formatDate(now));
    if (/\{\{[A-Z]+\}\}/.test(out)) throw new Error('unreplaced placeholder in the template');
    return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { values } = parseArgs({
        options: {
            listing: { type: 'string' },
            releases: { type: 'string' },
            current: { type: 'string' },
            out: { type: 'string' },
            template: { type: 'string', default: join(dirname(fileURLToPath(import.meta.url)), 'index.html') },
        },
    });
    for (const k of ['listing', 'releases', 'current', 'out']) {
        if (!values[k]) throw new Error(`--${k} is required`);
    }
    const html = renderIndex({
        template: readFileSync(values.template, 'utf8'),
        listing: JSON.parse(readFileSync(values.listing, 'utf8')),
        releases: JSON.parse(readFileSync(values.releases, 'utf8')),
        current: values.current,
    });
    writeFileSync(values.out, html);
    console.log(`wrote ${values.out} (${html.length} bytes)`);
}
