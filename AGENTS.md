# AGENTS.md

Guidance for coding agents working on this repository.

## Project overview

This is a small JavaScript VS Code extension named **vscode-tabular**. It helps users view and edit delimiter-separated text as aligned columns.

Key files:

- `package.json` — extension manifest, command contributions, npm scripts, dev dependencies.
- `extension.js` — VS Code extension entry point. Registers commands, prompts for delimiters, manages per-document state, status bar item, and editor decorations.
- `lib/tabular.js` — pure tabular parsing/alignment logic. Most algorithmic changes should happen here.
- `test/tabular.test.js` — Node-based unit tests for `lib/tabular.js` behavior.
- `README.md` — user-facing usage and packaging documentation.
- `.vscode/launch.json` — VS Code Extension Development Host launch config.
- `.vscodeignore` — files excluded from packaged VSIX.

## Commands

Run these from the repository root:

```bash
npm test          # run unit tests
npm run lint      # syntax-check JS files with node --check
npm run build:vsix # lint, test, then package with vsce
```

There is no transpilation step and no test framework dependency; tests are plain Node scripts using `node:assert/strict`.

## Development workflow

1. Prefer putting pure parsing/alignment behavior in `lib/tabular.js`.
2. Add or update assertions in `test/tabular.test.js` for algorithm changes.
3. Run `npm test` and `npm run lint` before finishing.
4. For extension UI/VS Code API behavior, update `extension.js` and, when relevant, `README.md`.
5. To manually test in VS Code, open this folder, choose **Run Extension**, and press `F5`.

## Architecture notes

- `extension.js` keeps enabled files in the `enabledDocuments` map, keyed by `document.uri.toString()`.
- Visual alignment uses VS Code decorations with zero-width ranges and `before.contentText` made from `VIRTUAL_SPACE` (`\u00a0`) so padding does not collapse.
- `computePadding()` computes virtual spaces before delimiters; `computePostDelimiterSpacing()` adds one virtual space after non-space delimiters when needed.
- `applyAlignmentToLines()` commits the same computed alignment as real spaces.
- `compactLines()` trims whitespace in cells; for a single-space delimiter it compacts separator runs to one space.
- A single-space delimiter is special: runs of one or more spaces are treated as separators, and spaces inside cell contents are not supported.
- Delimiter detection is intentionally simple and counts occurrences of common delimiters: comma, tab, semicolon, pipe, and space.

## Code style and constraints

- Use CommonJS (`require`/`module.exports`), matching the existing code.
- Keep `lib/tabular.js` independent from the VS Code API so it remains easy to unit test.
- Maintain idempotency where expected: applying alignment to already aligned lines should not keep adding spaces.
- Preserve line endings when replacing whole documents; `replaceDocumentLines()` currently uses the document EOL.
- Avoid adding heavy dependencies unless clearly justified; this extension is intentionally lightweight.
- If packaging behavior changes, update `.vscodeignore` and `README.md` together.

## Known limitations / assumptions

- CSV parsing is delimiter-based only; quoted delimiters and escaped quotes are not currently handled.
- `visibleWidth()` returns JavaScript string length, not terminal/editor display width for wide Unicode characters.
- Space-delimited parsing cannot represent cells containing spaces.
- Tests cover pure alignment logic, not VS Code integration behavior.
