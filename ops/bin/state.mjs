#!/usr/bin/env node
// Moves everything that must not live in the public repo between devices,
// through the private repo amshahed/sensei-private. How to use it: ops/DEVICES.md.
//
//   node ops/bin/state.mjs status   what differs between this device and the store
//   node ops/bin/state.mjs push     collect this device's state, encrypt the secret parts, commit, push
//   node ops/bin/state.mjs pull     pull, decrypt, restore; anything it would overwrite is backed up first
//   node ops/bin/state.mjs init     once, ever: set the store's passphrase check (needs the passphrase)
//
// Passphrase: $SENSEI_STATE_PASSPHRASE, else the file ~/.config/sensei/state-passphrase.
// Store clone: $SENSEI_STATE_DIR, else ~/.sensei-state. Remote: $SENSEI_STATE_REMOTE,
// else amshahed/sensei-private (cloned with gh).
//
// Never loses anything:
// - push only adds or updates files in the store; a file gone locally stays in the store;
// - pull backs up every local file it would overwrite to ~/.sensei-state-backups/<time>/;
// - git history in the store keeps every pushed version.
//
// Secrets (.env, session transcripts, prompt history) are gzipped, then encrypted with
// AES-256-GCM under a key derived from the passphrase with scrypt. Plain files are the
// ones with no secrets: lesson drafts, memory, ~/.claude config, the public datasets.
// Needs only Node 22+ and git (and gh for the first clone), so it runs on macOS, Linux
// and Windows.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const home = os.homedir();
const claudeHome = path.join(home, '.claude');
// Claude Code keys a project's transcripts by its absolute path with every
// non-alphanumeric character replaced by "-" (/Users/sh/workspace/sensei →
// -Users-sh-workspace-sensei). Override with $SENSEI_CLAUDE_PROJECT_KEY if needed.
const projectKey =
  process.env.SENSEI_CLAUDE_PROJECT_KEY || repoRoot.replace(/[^a-zA-Z0-9]/g, '-');
const claudeProject = path.join(claudeHome, 'projects', projectKey);
const storeDir = process.env.SENSEI_STATE_DIR || path.join(home, '.sensei-state');
const remote = process.env.SENSEI_STATE_REMOTE || 'amshahed/sensei-private';
const passFile = path.join(home, '.config', 'sensei', 'state-passphrase');
const host = os.hostname();

// What travels. `logical` is the path inside the store; its first segment says
// where it lives locally. mode: plain (copied), gz (gzipped), enc (gzip + encrypt).
// restore: true (overwrite, after a backup), 'if-missing', or false (reference only).
const ITEMS = [
  { logical: 'repo/apps/api/.env', mode: 'enc' },
  { logical: 'repo/apps/mobile/.env', mode: 'enc' },
  { logical: 'repo/tools/authoring/output', dir: true, mode: 'plain' },
  { logical: 'repo/tools/authoring/published', dir: true, mode: 'plain' },
  { logical: 'repo/apps/api/data/sources', dir: true, mode: 'gz' },
  { logical: 'claude-project', dir: true, mode: 'enc', plainUnder: ['memory/'] },
  { logical: 'claude-home/CLAUDE.md', mode: 'plain' },
  { logical: 'claude-home/templates', dir: true, mode: 'plain' },
  { logical: 'claude-home/skills', dir: true, mode: 'plain' },
  { logical: 'claude-home/settings.json', mode: 'plain' },
  { logical: 'claude-home/settings.local.json', mode: 'plain' },
  { logical: 'claude-home/keybindings.json', mode: 'plain' },
  { logical: 'claude-home/history.jsonl', mode: 'enc', restore: 'if-missing' },
  { logical: 'claude-home/file-history', dir: true, mode: 'enc' },
  { logical: 'claude-home/plugins/known_marketplaces.json', mode: 'plain', restore: false },
  { logical: 'claude-home/plugins/installed_plugins.json', mode: 'plain', restore: false },
];
const SKIP = new Set(['.DS_Store', 'node_modules']);
const GITHUB_FILE_LIMIT = 95 * 1024 * 1024;

function localPath(logical) {
  const [root, ...rest] = logical.split('/');
  const base = { repo: repoRoot, 'claude-project': claudeProject, 'claude-home': claudeHome }[root];
  if (!base) throw new Error(`unknown root in ${logical}`);
  return path.join(base, ...rest);
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
  }
  return r;
}

// ── Passphrase and crypto ────────────────────────────────────────────────────
function passphrase() {
  if (process.env.SENSEI_STATE_PASSPHRASE) return process.env.SENSEI_STATE_PASSPHRASE;
  if (fs.existsSync(passFile)) return fs.readFileSync(passFile, 'utf8').replace(/\r?\n$/, '');
  throw new Error(
    `No passphrase. Create ${passFile} in your own terminal (see ops/DEVICES.md), ` +
      'or set SENSEI_STATE_PASSPHRASE.',
  );
}

const CRYPTO_FILE = 'crypto.json';
const CHECK_TEXT = 'sensei-state-ok';

function deriveKey(pass, meta) {
  return crypto.scryptSync(pass, Buffer.from(meta.salt, 'base64'), 32, {
    N: meta.N,
    r: meta.r,
    p: meta.p,
    maxmem: 256 * 1024 * 1024,
  });
}

function encrypt(key, plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([Buffer.from('SST1'), iv, c.getAuthTag(), body]);
}

function decrypt(key, blob) {
  if (blob.subarray(0, 4).toString() !== 'SST1') throw new Error('not a state file');
  const iv = blob.subarray(4, 16);
  const tag = blob.subarray(16, 32);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(blob.subarray(32)), d.final()]);
}

let cachedKey = null;
function key() {
  if (cachedKey) return cachedKey;
  const metaPath = path.join(storeDir, CRYPTO_FILE);
  if (!fs.existsSync(metaPath)) throw new Error('Store has no crypto.json yet. Run `init` first.');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const k = deriveKey(passphrase(), meta);
  try {
    if (decrypt(k, Buffer.from(meta.check, 'base64')).toString() !== CHECK_TEXT) throw new Error();
  } catch {
    throw new Error('Wrong passphrase for this store.');
  }
  cachedKey = k;
  return k;
}

// ── Store ────────────────────────────────────────────────────────────────────
function ensureStore() {
  let cloned = false;
  if (!fs.existsSync(path.join(storeDir, '.git'))) {
    if (fs.existsSync(remote) || /^(git@|https?:|file:|\/)/.test(remote)) {
      sh('git', ['clone', '-q', remote, storeDir]);
    } else {
      sh('gh', ['repo', 'clone', remote, storeDir, '--', '-q']);
    }
    cloned = true;
  }
  const hasHead = sh('git', ['-C', storeDir, 'rev-parse', '--verify', 'HEAD'], { allowFail: true });
  if (hasHead.status !== 0) {
    // An empty store: name the first branch main, whatever git's default is.
    sh('git', ['-C', storeDir, 'symbolic-ref', 'HEAD', 'refs/heads/main']);
  } else if (!cloned) {
    const up = sh('git', ['-C', storeDir, 'rev-parse', '--abbrev-ref', '@{u}'], { allowFail: true });
    if (up.status === 0) sh('git', ['-C', storeDir, 'pull', '-q', '--ff-only']);
  }
}

const manifestPath = () => path.join(storeDir, 'manifest.json');
function readManifest() {
  return fs.existsSync(manifestPath())
    ? JSON.parse(fs.readFileSync(manifestPath(), 'utf8'))
    : { files: {} };
}

function storeFile(logical, mode) {
  const ext = { plain: '', gz: '.gz', enc: '.enc' }[mode];
  return path.join(storeDir, 'files', ...logical.split('/')) + ext;
}

// ── Walking local state ──────────────────────────────────────────────────────
function walk(dir, rel = '', seen = new Set()) {
  const out = [];
  let real;
  try {
    real = fs.realpathSync(dir);
  } catch {
    return out;
  }
  if (seen.has(real)) return out;
  seen.add(real);
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(full); // follows symlinks (skills/grill-me)
    } catch {
      continue;
    }
    const r = rel ? `${rel}/${name}` : name;
    if (st.isDirectory()) out.push(...walk(full, r, seen));
    else if (st.isFile()) out.push(r);
  }
  return out;
}

/** Every local file that travels: [{ logical, local, mode, restore }]. */
function localEntries() {
  const out = [];
  for (const item of ITEMS) {
    const base = localPath(item.logical);
    if (!fs.existsSync(base)) continue;
    if (item.dir) {
      for (const rel of walk(base)) {
        const plain = item.plainUnder?.some((p) => rel.startsWith(p));
        out.push({
          logical: `${item.logical}/${rel}`,
          local: path.join(base, ...rel.split('/')),
          mode: plain ? 'plain' : item.mode,
          restore: item.restore ?? true,
        });
      }
    } else {
      out.push({ logical: item.logical, local: base, mode: item.mode, restore: item.restore ?? true });
    }
  }
  return out;
}

function itemFor(logical) {
  return ITEMS.find((i) => logical === i.logical || logical.startsWith(`${i.logical}/`));
}

// ── Commands ─────────────────────────────────────────────────────────────────
function cmdInit() {
  ensureStore();
  const metaPath = path.join(storeDir, CRYPTO_FILE);
  if (fs.existsSync(metaPath)) {
    key(); // verifies the passphrase
    console.log('Store already initialised; passphrase OK.');
    return;
  }
  const meta = { v: 1, kdf: 'scrypt', N: 2 ** 15, r: 8, p: 1, salt: crypto.randomBytes(16).toString('base64') };
  const k = deriveKey(passphrase(), meta);
  meta.check = encrypt(k, Buffer.from(CHECK_TEXT)).toString('base64');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
  fs.writeFileSync(
    path.join(storeDir, '.gitattributes'),
    '*.enc binary\n*.gz binary\n',
  );
  console.log('Initialised the store with your passphrase. Now run `push`.');
}

function cmdStatus() {
  ensureStore();
  const { files } = readManifest();
  const local = localEntries();
  const seen = new Set();
  let changed = 0, fresh = 0, same = 0;
  for (const e of local) {
    seen.add(e.logical);
    const m = files[e.logical];
    const s = sha256(fs.readFileSync(e.local));
    if (!m) {
      fresh++;
      console.log(`  new here      ${e.logical}`);
    } else if (m.sha256 !== s) {
      changed++;
      console.log(`  changed here  ${e.logical}`);
    } else same++;
  }
  const onlyStore = Object.keys(files).filter((l) => !seen.has(l));
  for (const l of onlyStore) console.log(`  only in store ${l}`);
  const active = fs.existsSync(path.join(storeDir, 'ACTIVE.json'))
    ? JSON.parse(fs.readFileSync(path.join(storeDir, 'ACTIVE.json'), 'utf8'))
    : null;
  console.log(
    `status: ${same} same, ${changed} changed here, ${fresh} new here, ${onlyStore.length} only in store.` +
      (active ? ` Last push: ${active.host} at ${active.pushedAt}.` : ' Nothing pushed yet.'),
  );
}

function cmdPush() {
  ensureStore();
  const manifest = readManifest();
  let written = 0, unchanged = 0;
  for (const e of localEntries()) {
    const buf = fs.readFileSync(e.local);
    const s = sha256(buf);
    const prev = manifest.files[e.logical];
    const target = storeFile(e.logical, e.mode);
    if (prev && prev.sha256 === s && prev.mode === e.mode && fs.existsSync(target)) {
      unchanged++;
      continue;
    }
    let out = buf;
    if (e.mode === 'gz') out = zlib.gzipSync(buf, { level: 9 });
    if (e.mode === 'enc') out = encrypt(key(), zlib.gzipSync(buf, { level: 9 }));
    if (out.length > GITHUB_FILE_LIMIT) {
      throw new Error(`${e.logical} is ${(out.length / 1e6).toFixed(0)} MB stored, over GitHub's file limit.`);
    }
    if (prev && prev.mode !== e.mode) fs.rmSync(storeFile(e.logical, prev.mode), { force: true });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, out);
    manifest.files[e.logical] = { sha256: s, size: buf.length, mode: e.mode, from: host, at: new Date().toISOString() };
    written++;
  }
  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2) + '\n');
  const head = sh('git', ['-C', repoRoot, 'rev-parse', '--short', 'HEAD'], { allowFail: true }).stdout.trim();
  fs.writeFileSync(
    path.join(storeDir, 'ACTIVE.json'),
    JSON.stringify({ host, user: os.userInfo().username, repoRoot, pushedAt: new Date().toISOString(), sensei: head }, null, 2) + '\n',
  );
  sh('git', ['-C', storeDir, 'add', '-A']);
  const dirty = sh('git', ['-C', storeDir, 'status', '--porcelain']).stdout.trim();
  if (dirty) {
    sh('git', ['-C', storeDir, 'commit', '-q', '-m', `state push from ${host}: ${written} file(s) updated`]);
  }
  const up = sh('git', ['-C', storeDir, 'rev-parse', '--abbrev-ref', '@{u}'], { allowFail: true });
  if (up.status === 0) sh('git', ['-C', storeDir, 'push', '-q']);
  else sh('git', ['-C', storeDir, 'push', '-q', '-u', 'origin', 'HEAD']);
  console.log(`push: ${written} updated, ${unchanged} unchanged. Store: ${remote}.`);
}

function cmdPull() {
  ensureStore();
  const { files } = readManifest();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(home, '.sensei-state-backups', stamp);
  let restored = 0, same = 0, backedUp = 0, kept = 0;
  for (const [logical, m] of Object.entries(files)) {
    const item = itemFor(logical);
    const restore = item ? (item.restore ?? true) : true;
    if (restore === false) continue;
    const local = localPath(logical);
    const exists = fs.existsSync(local);
    if (exists && restore === 'if-missing') {
      kept++;
      continue;
    }
    if (exists && sha256(fs.readFileSync(local)) === m.sha256) {
      same++;
      continue;
    }
    let buf = fs.readFileSync(storeFile(logical, m.mode));
    if (m.mode === 'gz') buf = zlib.gunzipSync(buf);
    if (m.mode === 'enc') buf = zlib.gunzipSync(decrypt(key(), buf));
    if (sha256(buf) !== m.sha256) throw new Error(`${logical}: content check failed`);
    if (exists) {
      const b = path.join(backupDir, ...logical.split('/'));
      fs.mkdirSync(path.dirname(b), { recursive: true });
      fs.copyFileSync(local, b);
      backedUp++;
    }
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, buf);
    restored++;
  }
  const active = fs.existsSync(path.join(storeDir, 'ACTIVE.json'))
    ? JSON.parse(fs.readFileSync(path.join(storeDir, 'ACTIVE.json'), 'utf8'))
    : null;
  console.log(
    `pull: ${restored} restored, ${same} already the same, ${kept} kept (local wins)` +
      (backedUp ? `, ${backedUp} local file(s) backed up to ${backupDir}` : '') +
      '.' +
      (active ? ` Last push: ${active.host} at ${active.pushedAt}, sensei ${active.sensei}.` : ''),
  );
  console.log(`Claude transcripts and memory went to ${claudeProject}`);
}

const cmd = process.argv[2];
try {
  if (cmd === 'init') cmdInit();
  else if (cmd === 'status') cmdStatus();
  else if (cmd === 'push') cmdPush();
  else if (cmd === 'pull') cmdPull();
  else {
    console.error('usage: node ops/bin/state.mjs <status|push|pull|init>');
    process.exit(2);
  }
} catch (err) {
  console.error(`state: ${err.message}`);
  process.exit(1);
}
