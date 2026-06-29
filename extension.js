const vscode = require('vscode');
const {
  VIRTUAL_SPACE,
  applyAlignmentToLines,
  compactLines,
  computePadding,
  computePostDelimiterSpacing,
  detectDelimiter,
  transposeLines,
} = require('./lib/tabular');

const TRANSPOSED_SCHEME = 'tabular-transpose';

const enabledDocuments = new Map();
const transposedSnapshots = new Map();
let nextTransposedSnapshotId = 1;
let decorationType;
let statusBarItem;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  decorationType = vscode.window.createTextEditorDecorationType({});
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'tabularViewingMode.status';

  context.subscriptions.push(decorationType, statusBarItem);
  context.subscriptions.push(vscode.workspace.registerFileSystemProvider(
    TRANSPOSED_SCHEME,
    new TransposedFileSystemProvider(),
    { isReadonly: true }
  ));

  context.subscriptions.push(
    vscode.commands.registerCommand('tabularViewingMode.toggle', async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showInformationMessage('No active text editor to toggle.');
        return;
      }

      const key = documentKey(editor.document);
      const existingOptions = enabledDocuments.get(key);

      if (existingOptions) {
        disableViewingMode(editor.document);
        vscode.window.showInformationMessage('Tabular viewing mode disabled for this file');
        return;
      }

      const suggestedDelimiter = detectDelimiter(documentLines(editor.document));
      const delimiterInput = await vscode.window.showInputBox({
        title: 'Enable Tabular Viewing Mode',
        prompt: 'Enter the column delimiter. Use \\t for a tab.',
        value: delimiterInputValue(suggestedDelimiter),
        valueSelection: [0, delimiterInputValue(suggestedDelimiter).length],
      });

      if (delimiterInput === undefined) {
        return;
      }

      const delimiter = normalizeDelimiter(delimiterInput);

      if (!delimiter) {
        vscode.window.showErrorMessage('Delimiter cannot be empty.');
        return;
      }

      enabledDocuments.set(key, { delimiter });
      updateVisibleEditorsForDocument(editor.document);
      updateStatusBar();

      vscode.window.showInformationMessage(
        `Tabular viewing mode enabled for this file using delimiter ${displayDelimiter(delimiter)}`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tabularViewingMode.applyAlignment', async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showInformationMessage('No active text editor to align.');
        return;
      }

      const delimiter = await getDelimiterForCommand(editor.document, 'Apply Tabular Alignment to File');

      if (!delimiter) {
        return;
      }

      await replaceDocumentLines(editor, applyAlignmentToLines(documentLines(editor.document), delimiter));
      vscode.window.showInformationMessage('Applied tabular alignment to this file');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tabularViewingMode.openTransposed', async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showInformationMessage('No active text editor to transpose.');
        return;
      }

      const delimiter = await getDelimiterForCommand(editor.document, 'Open Transposed Tabular View');

      if (!delimiter) {
        return;
      }

      const lines = documentLines(editor.document);
      const transposedLines = applyAlignmentToLines(transposeLines(lines, delimiter), delimiter);
      const eol = editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
      const snapshotId = nextTransposedSnapshotId;
      nextTransposedSnapshotId += 1;

      const sourceName = editor.document.uri.path.split('/').pop() || 'untitled';
      const uri = vscode.Uri.from({
        scheme: TRANSPOSED_SCHEME,
        path: `/snapshot-${snapshotId}/${sourceName}.transposed`,
      });

      transposedSnapshots.set(uri.toString(), {
        content: transposedLines.join(eol),
        ctime: Date.now(),
      });

      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document, { preview: false });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tabularViewingMode.compactCells', async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showInformationMessage('No active text editor to compact.');
        return;
      }

      const delimiter = await getDelimiterForCommand(editor.document, 'Compact Tabular Cells');

      if (!delimiter) {
        return;
      }

      await replaceDocumentLines(editor, compactLines(documentLines(editor.document), delimiter));
      vscode.window.showInformationMessage('Compacted whitespace in tabular cells');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tabularViewingMode.status', async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor || !getViewingModeOptions(editor.document)) {
        updateStatusBar();
        return;
      }

      const selection = await vscode.window.showQuickPick([
        {
          label: 'Disable Tabular View for This File',
          description: 'Remove tabular alignment decorations from the active file',
        },
      ], {
        title: 'Tabular View',
        placeHolder: 'Choose an action',
      });

      if (selection) {
        disableViewingMode(editor.document);
        vscode.window.showInformationMessage('Tabular viewing mode disabled for this file');
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateStatusBar();
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => {
      updateAllVisibleEditors();
      updateStatusBar();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (!getViewingModeOptions(event.document)) {
        return;
      }

      updateVisibleEditorsForDocument(event.document);
    })
  );
}

/**
 * @param {vscode.TextDocument} document
 * @param {string} title
 */
async function getDelimiterForCommand(document, title) {
  const options = getViewingModeOptions(document);

  if (options) {
    return options.delimiter;
  }

  const suggestedDelimiter = detectDelimiter(documentLines(document));
  const delimiterInput = await vscode.window.showInputBox({
    title,
    prompt: 'Enter the column delimiter. Use \\t for a tab.',
    value: delimiterInputValue(suggestedDelimiter),
    valueSelection: [0, delimiterInputValue(suggestedDelimiter).length],
  });

  if (delimiterInput === undefined) {
    return undefined;
  }

  const delimiter = normalizeDelimiter(delimiterInput);

  if (!delimiter) {
    vscode.window.showErrorMessage('Delimiter cannot be empty.');
    return undefined;
  }

  return delimiter;
}

/**
 * @param {vscode.TextDocument} document
 */
function documentLines(document) {
  const lines = [];

  for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
    lines.push(document.lineAt(lineNumber).text);
  }

  return lines;
}

/**
 * @param {vscode.TextEditor} editor
 * @param {string[]} lines
 */
async function replaceDocumentLines(editor, lines) {
  const document = editor.document;
  const lastLine = document.lineAt(document.lineCount - 1);
  const fullRange = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
  const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';

  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, lines.join(eol));
  });
}

class TransposedFileSystemProvider {
  constructor() {
    this.onDidChangeFile = new vscode.EventEmitter().event;
  }

  /**
   * @param {vscode.Uri} uri
   */
  stat(uri) {
    const snapshot = getTransposedSnapshot(uri);

    return {
      type: vscode.FileType.File,
      ctime: snapshot.ctime,
      mtime: snapshot.ctime,
      size: Buffer.byteLength(snapshot.content),
    };
  }

  /**
   * @param {vscode.Uri} uri
   */
  readFile(uri) {
    return Buffer.from(getTransposedSnapshot(uri).content, 'utf8');
  }

  readDirectory() {
    return [];
  }

  createDirectory() {
    throw vscode.FileSystemError.NoPermissions('Transposed tabular views are read-only.');
  }

  writeFile() {
    throw vscode.FileSystemError.NoPermissions('Transposed tabular views are read-only.');
  }

  delete() {
    throw vscode.FileSystemError.NoPermissions('Transposed tabular views are read-only.');
  }

  rename() {
    throw vscode.FileSystemError.NoPermissions('Transposed tabular views are read-only.');
  }

  watch() {
    return new vscode.Disposable(() => {});
  }
}

/**
 * @param {vscode.Uri} uri
 */
function getTransposedSnapshot(uri) {
  const snapshot = transposedSnapshots.get(uri.toString());

  if (!snapshot) {
    throw vscode.FileSystemError.FileNotFound(uri);
  }

  return snapshot;
}

function updateAllVisibleEditors() {
  for (const editor of vscode.window.visibleTextEditors) {
    if (getViewingModeOptions(editor.document)) {
      applyDecorations(editor);
    } else {
      clearDecorations(editor);
    }
  }
}

/**
 * @param {vscode.TextDocument} document
 */
function updateVisibleEditorsForDocument(document) {
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document === document) {
      if (getViewingModeOptions(document)) {
        applyDecorations(editor);
      } else {
        clearDecorations(editor);
      }
    }
  }
}

/**
 * @param {vscode.TextDocument} document
 */
function disableViewingMode(document) {
  enabledDocuments.delete(documentKey(document));
  updateVisibleEditorsForDocument(document);
  updateStatusBar();
}

function updateStatusBar() {
  if (!statusBarItem) {
    return;
  }

  const editor = vscode.window.activeTextEditor;
  const options = editor ? getViewingModeOptions(editor.document) : undefined;

  if (!options) {
    statusBarItem.hide();
    return;
  }

  statusBarItem.text = `Tabular View ('${statusBarDelimiter(options.delimiter)}')`;
  statusBarItem.tooltip = 'Tabular viewing mode is enabled for this file. Click to disable.';
  statusBarItem.show();
}

/**
 * @param {vscode.TextDocument} document
 */
function getViewingModeOptions(document) {
  return enabledDocuments.get(documentKey(document));
}

/**
 * @param {vscode.TextDocument} document
 */
function documentKey(document) {
  return document.uri.toString();
}

/**
 * Adds virtual padding before delimiters so columns line up vertically.
 * @param {vscode.TextEditor} editor
 */
function applyDecorations(editor) {
  if (!editor || !decorationType) {
    return;
  }

  const options = getViewingModeOptions(editor.document);

  if (!options) {
    clearDecorations(editor);
    return;
  }

  const { delimiter } = options;
  const lines = [];

  for (let lineNumber = 0; lineNumber < editor.document.lineCount; lineNumber += 1) {
    lines.push(editor.document.lineAt(lineNumber).text);
  }

  const decorations = [
    ...computePadding(lines, delimiter),
    ...computePostDelimiterSpacing(lines, delimiter),
  ].map(({ lineNumber, character, padding }) => {
    const position = new vscode.Position(lineNumber, character);

    return {
      range: new vscode.Range(position, position),
      renderOptions: {
        before: {
          // Normal spaces collapse in VS Code injected text. Non-breaking spaces
          // preserve the exact padding width while still rendering like spaces.
          contentText: VIRTUAL_SPACE.repeat(padding),
          backgroundColor: 'rgba(127, 127, 127, 0.25)',
          color: 'transparent',
        },
      },
    };
  });

  editor.setDecorations(decorationType, decorations);
}

/**
 * @param {string} delimiter
 */
function normalizeDelimiter(delimiter) {
  return delimiter.replace(/\\t/g, '\t');
}

/**
 * @param {string} delimiter
 */
function displayDelimiter(delimiter) {
  return delimiter === '\t' ? '\\t' : JSON.stringify(delimiter);
}

/**
 * @param {string} delimiter
 */
function delimiterInputValue(delimiter) {
  return delimiter === '\t' ? '\\t' : delimiter;
}

/**
 * @param {string} delimiter
 */
function statusBarDelimiter(delimiter) {
  if (delimiter === '\t') {
    return '\\t';
  }

  if (delimiter === ' ') {
    return 'space';
  }

  return delimiter;
}

/**
 * @param {vscode.TextEditor} editor
 */
function clearDecorations(editor) {
  if (editor && decorationType) {
    editor.setDecorations(decorationType, []);
  }
}

function deactivate() {
  for (const editor of vscode.window.visibleTextEditors) {
    clearDecorations(editor);
  }
}

module.exports = {
  activate,
  deactivate,
};
