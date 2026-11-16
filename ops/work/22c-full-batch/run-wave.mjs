#!/usr/bin/env node
// Drafts and critiques one wave of the 22c batch, in course order.
//
//   node ops/work/22c-full-batch/run-wave.mjs <from> <to> <cap-usd> [--include-audio]
//
// <from> and <to> are 1-based positions in the course (lesson 1 to 120).
// Skips I-Listening and I-Speaking unless --include-audio, and skips any lesson
// that already has a draft or a rejected draft (the drafter never pays twice).
// Stops before a lesson when the running total has reached the cap.
// Appends one line per lesson to run-log.txt beside this file. Run from the main
// checkout, which holds apps/api/.env.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const out = join(root, 'tools', 'authoring', 'output');
const logPath = join(here, 'run-log.txt');

const [fromRaw, toRaw, capRaw] = process.argv.slice(2);
const includeAudio = process.argv.includes('--include-audio');
const from = Number(fromRaw);
const to = Number(toRaw);
const cap = Number(capRaw);
if (!(from >= 1 && to >= from && cap > 0)) {
  console.error('usage: run-wave.mjs <from> <to> <cap-usd> [--include-audio]');
  process.exit(2);
}

const skeleton = JSON.parse(readFileSync(join(out, 'skeleton.json'), 'utf8'));
const lessons = skeleton.module.chapters.flatMap((c) => c.lessons);
const audio = new Set(['I-Listening', 'I-Speaking']);

function log(line) {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  appendFileSync(logPath, stamped + '\n');
}

function run(args) {
  const r = spawnSync('pnpm', ['--filter', 'api', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return { code: r.status, text: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

function costOf(text, pattern) {
  const m = text.match(pattern);
  return m ? Number(m[1]) : 0;
}

let total = 0;
log(`wave ${from}-${to} start, cap $${cap.toFixed(2)}`);
for (let n = from; n <= to; n++) {
  const lesson = lessons[n - 1];
  if (!lesson) break;
  const tag = `#${n} ${lesson.id} ${lesson.type}`;
  if (audio.has(lesson.type) && !includeAudio) continue;
  const draft = join(out, `${lesson.id}.json`);
  const failedPath = join(out, `${lesson.id}.failed.json`);
  if (
    existsSync(draft) ||
    existsSync(join(out, `${lesson.id}.rejected.json`)) ||
    existsSync(failedPath)
  ) {
    continue;
  }
  if (total >= cap) {
    log(`STOP cap reached at $${total.toFixed(4)} before ${tag}`);
    process.exit(0);
  }

  const d = run(['authoring:draft', lesson.id, '--max-cost', '0.4']);
  const dCost = costOf(d.text, /estimated cost ~\$([0-9.]+)/);
  total += dCost;
  if (!existsSync(draft)) {
    if (existsSync(failedPath)) {
      // A paid reply that failed to parse is saved, not lost (authoring-hardening
      // item 1). Recover it with a hand fix and `authoring:draft <id> --recheck`.
      log(`PARSE-FAILED ${tag} draft $${dCost.toFixed(4)} total $${total.toFixed(4)} :: reply saved to ${lesson.id}.failed.json`);
      continue;
    }
    const rejected = existsSync(join(out, `${lesson.id}.rejected.json`));
    const why = d.text
      .split('\n')
      .filter((l) => /rror|reject|✗|fail|status|overload|timeout|ECONN/i.test(l))
      .filter((l) => !/ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL|authoring:draft — drafted/.test(l))
      .slice(0, 3)
      .join(' | ')
      .slice(0, 400);
    log(`${rejected ? 'REJECTED' : 'FAILED'} ${tag} draft $${dCost.toFixed(4)} total $${total.toFixed(4)} exit ${d.code} :: ${why}`);
    continue;
  }

  const c = run(['authoring:critique', draft]);
  const cCost = costOf(c.text, /tokens: \d+ in \/ \d+ out\s+\(~\$([0-9.]+)\)/);
  total += cCost;
  const verdict = /Overall: ✓ PASS/.test(c.text)
    ? 'PASS'
    : /Overall: ✗ FAIL/.test(c.text)
      ? 'FAIL'
      : `ERROR exit ${c.code}`;
  const misses = c.text
    .split('\n')
    .filter((l) => /^\s+✗ /.test(l))
    .map((l) => l.trim().slice(2, 90))
    .join(' | ');
  const invalid = d.text.match(/\[validator\] FAIL — (.*)/);
  log(`DRAFTED ${tag} draft $${dCost.toFixed(4)}${invalid ? ` VALIDATOR-FAIL (${invalid[1].slice(0, 200)})` : ''} critic ${verdict} $${cCost.toFixed(4)} total $${total.toFixed(4)}${misses ? ` :: ${misses}` : ''}`);
}
log(`wave ${from}-${to} done, total $${total.toFixed(4)}`);
