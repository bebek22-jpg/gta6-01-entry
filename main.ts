// Solmar Heat — the entry program for make.fun's gta6-01 ("Make GTA 6").
// Node 22, standard library only. It hands the game in: copies this repo's
// game/ (a three.js open-world crime game that plays offline from static
// files) and screenshots/ (four real renders of the game) into the output
// directory, then writes dossier.json — the summary the judge reads — with
// the vendored make.fun library.
//
// Play it locally first: `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's caps, so a bad entry fails here instead of at the gate:
// at most 4 screenshots of 256 KiB each, game/ at most 993 files and
// 48 MiB with no path over 1000 bytes, dossier text capped at 160 KiB.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
