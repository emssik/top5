1. Add @codemirror/state, view, commands (task: New dependencies).
2. `dumpLineHang` in src/shared/dump.ts + tests appended to tests/dump-tags.test.ts (task: Contract/Examples).
3. DumpEditor.tsx: CM6 wrapper — history, hang/tag decorations, handle (replace/load annotated, not echoed), sticky bar from lineBlockAt, scrollMargins, native undo routing (task: Contract, Editor behaviour).
4. DumpView.tsx: swap el.* for the handle, drop highlight/sticky code (DumpView.tsx:51-139, 303-327, 399-423, 511-534).
5. Dashboard.tsx:164 checks `dump-textarea` class -> `.dump-editor` closest (trivial, outside list).
6. styles.css: replace dump-layer/highlight/textarea rules with CM rules; writer + hang CSS (good-css).
7. Verify: npm test, build, headless screenshot of bundled editor, gate.
