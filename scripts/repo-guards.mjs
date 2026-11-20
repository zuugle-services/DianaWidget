#!/usr/bin/env node
/**
 * Repository guards shared by the pre-commit hook (.githooks/pre-commit) and CI (pr-guards.yml).
 * No dependencies; works on Windows and Linux.
 *
 *   node scripts/repo-guards.mjs secrets   [--base REF]   no env files / credential files in the change
 *   node scripts/repo-guards.mjs protected [--base REF]   CI / release config needs ALLOW_PROTECTED=1
 *   node scripts/repo-guards.mjs version   [--base REF]   version + changelog belong to release-please
 *   node scripts/repo-guards.mjs all       [--base REF]
 *
 * Without --base the staged changes are checked (pre-commit). With --base the diff REF...HEAD is checked
 * (CI on a pull request). Release-please's own branches (release-please--*) are exempt from `protected`
 * and `version`: bumping the version is their job.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Paths that change CI, deploys or release automation. Touching them needs ALLOW_PROTECTED=1.
const PROTECTED_PREFIXES = ['.github/', '.githooks/', 'scripts/repo-guards.mjs', 'release-please-config.json'];
// Owned by release-please: written by the release PR, never by hand.
const RELEASE_FILES = ['CHANGELOG.md', '.release-please-manifest.json'];
// Files that hold credentials locally and must never be committed.
const SECRET_NAMES = ['client_id_secret.php'];

function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** [status, path] pairs of the change; a rename yields the old path as 'R' and the new one as 'A'. */
function changes(base) {
    const out = base
        ? git('diff', '--name-status', '-M', `${base}...HEAD`)
        : git('diff', '--cached', '--name-status', '-M');
    const result = [];
    for (const line of out.split('\n').filter(Boolean)) {
        const parts = line.split('\t');
        const status = parts[0][0];
        if (status === 'R' && parts.length > 2) {
            result.push(['R', parts[1]], ['A', parts[2]]);
        } else {
            result.push([status, parts[1]]);
        }
    }
    return result;
}

function isReleaseBranch() {
    const ref = process.env.HEAD_REF || (() => {
        try {
            return git('rev-parse', '--abbrev-ref', 'HEAD').trim();
        } catch {
            return '';
        }
    })();
    return ref.startsWith('release-please--');
}

function secrets(base) {
    const bad = changes(base)
        .filter(([s]) => s !== 'D')
        .map(([, p]) => p)
        .filter((p) => {
            const name = path.posix.basename(p.replace(/\\/g, '/'));
            return SECRET_NAMES.includes(name) || ((name === '.env' || name.startsWith('.env.')) && name !== '.env.example');
        });
    if (bad.length) {
        console.log('Refusing to commit credential / env files:');
        bad.forEach((p) => console.log(`  ${p}`));
        console.log('Unstage with: git restore --staged <file>');
        return 1;
    }
    return 0;
}

function protectedPaths(base) {
    if (isReleaseBranch()) return 0;
    const hits = [...new Set(changes(base).map(([, p]) => p).filter((p) => PROTECTED_PREFIXES.some((pre) => p.startsWith(pre))))].sort();
    if (hits.length && process.env.ALLOW_PROTECTED !== '1') {
        console.log('These paths are protected (CI / deploy / release automation):');
        hits.forEach((p) => console.log(`  ${p}`));
        console.log("If the change is intended, commit with ALLOW_PROTECTED=1 (CI: label the PR 'allow-protected').");
        return 1;
    }
    return 0;
}

function readVersion(rev) {
    try {
        const raw = rev === null ? git('show', ':package.json') : git('show', `${rev}:package.json`);
        return JSON.parse(raw).version;
    } catch {
        return undefined;
    }
}

function version(base) {
    if (isReleaseBranch()) return 0;
    const problems = [];
    const before = readVersion(base ? git('merge-base', base, 'HEAD').trim() : 'HEAD');
    const after = readVersion(base ? 'HEAD' : null);
    if (before !== undefined && after !== undefined && before !== after) {
        problems.push(`package.json version ${before} -> ${after}`);
    }
    const touched = changes(base).map(([, p]) => p).filter((p) => RELEASE_FILES.includes(p));
    touched.forEach((p) => problems.push(`${p} changed`));
    if (problems.length && process.env.ALLOW_PROTECTED !== '1') {
        console.log('Versions and the changelog are written by release-please, not by hand:');
        problems.forEach((p) => console.log(`  ${p}`));
        console.log('Use a conventional-commit PR title instead (feat: -> minor, fix: -> patch, feat!: -> major).');
        return 1;
    }
    return 0;
}

function main(argv) {
    const [guard, ...rest] = argv;
    const baseIdx = rest.indexOf('--base');
    const base = baseIdx >= 0 ? rest[baseIdx + 1] : null;
    const guards = { secrets, protected: protectedPaths, version };
    if (guard === 'all') {
        return Object.values(guards).reduce((rc, fn) => fn(base) || rc, 0);
    }
    if (!guards[guard]) {
        console.log('usage: node scripts/repo-guards.mjs <secrets|protected|version|all> [--base REF]');
        return 2;
    }
    return guards[guard](base);
}

process.exit(main(process.argv.slice(2)));
