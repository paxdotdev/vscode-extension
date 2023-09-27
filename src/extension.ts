import * as path from 'path';
import { workspace, ExtensionContext, window, languages, Position, CancellationToken, CompletionItemProvider, ProviderResult, CompletionItem, CompletionList, DefinitionProvider, Definition, TextDocument, TextDocumentChangeEvent, Uri, TextEdit, Location, LocationLink, commands, Range, Hover } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  RequestType,
  ServerOptions,
} from 'vscode-languageclient/node';
import EnrichmentProxy, { EnrichParams } from './enrichmentProxy';


export interface SymbolData {
  uri: string,
  position: Position,
}

interface SymbolLocationParams {
  symbol: SymbolData;
}


const GetDefinitionRequest = 'pax/getDefinition';
const GetHoverRequest = 'pax/getHover';
const EnrichmentRequest = 'pax/enrich';

let client: LanguageClient;
let enrichmentProxy: EnrichmentProxy;

export function activate(context: ExtensionContext) {

  console.log('Your extension "pax" is now active!');

  let serverOptions: ServerOptions = {
    run: {
      command: path.resolve(__dirname, '../../pax/pax-language-server/target/debug/pax-language-server')
    },
    debug: {
      command: path.resolve(__dirname, '../../pax/pax-language-server/target/debug/pax-language-server'),
    }
  };

  let outputChannel = window.createOutputChannel('Pax Language Server');

  let clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'pax' },
      { scheme: 'file', language: 'rust' }
  ],
  synchronize: {
      fileEvents: workspace.createFileSystemWatcher('{**/*.pax,**/*.rs}'),
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

  enrichmentProxy = new EnrichmentProxy();

  client.onReady().then(() => {

      client.onRequest(GetDefinitionRequest, async (params: SymbolLocationParams) => {
        const uri = Uri.file(params.symbol.uri);
        const resp: LocationLink[] = await commands.executeCommand('vscode.executeDefinitionProvider', uri, params.symbol.position);
        let locations = [];
        if (resp.length > 0) {
          locations.push({
            targetUri: resp[0].targetUri.toString(),
            targetRange: resp[0].targetRange,
            targetSelectionRange: resp[0].targetSelectionRange,
            originSelectionRange: resp[0].originSelectionRange,
          });
        }
        return {
          locations
        };
      });

    client.onRequest(GetHoverRequest, async (params: SymbolLocationParams) => {
      const uri = Uri.file(params.symbol.uri);
      const resp: Hover[] = await commands.executeCommand('vscode.executeHoverProvider', uri, params.symbol.position);
      return resp
    });

    client.onRequest(EnrichmentRequest, async (params: EnrichParams) => {
      const enrichmentResult = await enrichmentProxy.enrich(params);
      return enrichmentResult;
  });
  
  
    workspace.onDidOpenTextDocument(sendDocumentOpen);
    workspace.onDidCloseTextDocument(sendDocumentClose);
    workspace.onDidSaveTextDocument(sendDocumentSave);
    workspace.onDidChangeTextDocument(sendDocumentChange);
    languages.registerCompletionItemProvider({ scheme: 'file', language: 'pax' }, new PaxCompletionItemProvider(), ...['<','.','@',':','=']);
    languages.registerDefinitionProvider({ scheme: 'file', language: 'pax' }, new PaxDefinitionProvider());
  });

  

  context.subscriptions.push(client.start());
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function sendDocumentOpen(document: TextDocument) {
    client.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: document.uri.toString(),
        languageId: document.languageId,
        version: document.version,
        text: document.getText()
      }
    });
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

