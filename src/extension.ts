import * as path from 'path';
import { workspace, ExtensionContext, window, languages, Position, CancellationToken, CompletionItemProvider, ProviderResult, CompletionItem, CompletionList, DefinitionProvider, Definition, TextDocument, TextDocumentChangeEvent, Uri, TextEdit } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {

  console.log('Congratulations, your extension "pax" is now active!');

  let serverOptions: ServerOptions = {
    run: {
      command: path.resolve(__dirname, '../../target/debug/pax-language-server')
    },
    debug: {
      command: path.resolve(__dirname, '../../target/debug/pax-language-server'),
    }
  };

  let outputChannel = window.createOutputChannel('Pax Language Server');

  let clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'pax' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.pax'),
    },
    outputChannel: outputChannel,  
    revealOutputChannelOn: 1,
    initializationOptions: {
      workspaceFolders: workspace.workspaceFolders?.map(folder => folder.uri.fsPath)
    }
  };

  client = new LanguageClient(
      'paxLanguageServer',
      'Pax Language Server',
      serverOptions,
      clientOptions
  );

  client.onReady().then(() => {
    workspace.onDidOpenTextDocument(sendDocumentOpen);
    workspace.onDidCloseTextDocument(sendDocumentClose);
    workspace.onDidSaveTextDocument(sendDocumentSave);
    workspace.onDidChangeTextDocument(sendDocumentChange);
    languages.registerCompletionItemProvider({ scheme: 'file', language: 'pax' }, new PaxCompletionItemProvider(), ...['<','.','@',':','=']);
    languages.registerDefinitionProvider({ scheme: 'file', language: 'pax' }, new PaxDefinitionProvider());
  });

  context.subscriptions.push(client.start());
}

function sendDocumentOpen(document: TextDocument) {
  if(document.languageId === 'pax') {
    client.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: document.uri.toString(),
        languageId: 'pax',
        version: document.version,
        text: document.getText()
      }
    });
  }
}

function sendDocumentClose(document: TextDocument) {
  client.sendNotification('textDocument/didClose', {
    textDocument: {
      uri: document.uri.toString()
    }
  });
}

function sendDocumentSave(document: TextDocument) {
  client.sendNotification('textDocument/didSave', {
    textDocument: {
      uri: document.uri.toString()
    },
    text: document.getText()
  });
}

function sendDocumentChange(event: TextDocumentChangeEvent) {
  console.log("sending change");
  client.sendNotification('textDocument/didChange', {
    textDocument: {
      uri: event.document.uri.toString(),
      version: event.document.version
    },
    contentChanges: [{
      text: event.document.getText()
    }]
  });
}

class PaxCompletionItemProvider implements CompletionItemProvider {
  provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<CompletionItem[] | CompletionList> {
    // You can use the client here to send a request to the server to get the completion items.
    // For now, it just returns a static list of items.
    return [new CompletionItem('CompletionItem1'), new CompletionItem('CompletionItem2')];
  }
}

class PaxDefinitionProvider implements DefinitionProvider {
  provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition> {
    // You can use the client here to send a request to the server to get the definition location.
    // For now, it just returns an empty array.
    return [];
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
