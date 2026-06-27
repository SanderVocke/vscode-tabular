const vscode = require('vscode');
const { VIRTUAL_SPACE, computePadding, computePostDelimiterSpacing } = require('./lib/tabular');

const enabledDocuments = new Map();
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

      const delimiterInput = await vscode.window.showInputBox({
        title: 'Enable Tabular Viewing Mode',
        prompt: 'Enter the column delimiter. Use \\t for a tab.',
        value: ',',
        valueSelection: [0, 1],
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
