#!/usr/bin/env python3
"""Run the bundled official Google DESIGN.md 0.4.0 CLI."""
from pathlib import Path
import shutil, subprocess, sys
node = shutil.which('node')
if not node:
    print('Google DESIGN.md requires Node.js >=18; no official lint was run.', file=sys.stderr)
    raise SystemExit(127)
if len(sys.argv) < 2:
    print('Usage: designmd.py lint|diff|export|spec [arguments]', file=sys.stderr)
    raise SystemExit(2)
cli = Path(__file__).resolve().parent / 'google-cli' / 'index.mjs'
raise SystemExit(subprocess.run([node, str(cli), *sys.argv[1:]]).returncode)
