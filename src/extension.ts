import { workspace, ExtensionContext, window, languages, Position, CancellationToken, ProviderResult, CompletionItem, CompletionList, DefinitionProvider, Definition, TextDocument, TextDocumentChangeEvent, Uri, TextEdit, Location, LocationLink, commands, Range, Hover, DefinitionLink, HoverProvider, CompletionContext, CompletionItemProvider, SnippetString } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  RequestType,
  ServerOptions,
} from 'vscode-languageclient/node';
import EnrichmentProxy, { EnrichParams, EnrichmentType } from './enrichmentProxy';


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

async function ensureRustAnalyzerIsReady() {
  await commands.executeCommand('rust-analyzer.run');
  await delay(8000);
}

export async function activate(context: ExtensionContext) {

  await ensureRustAnalyzerIsReady();
  console.log('Your extension "pax" is now active!')

  let serverOptions: ServerOptions = {
    run: {
      command: "pax-cli",
      args: ["lsp"],
    },
    debug: {
      command: "pax-cli",
      args: ["lsp"],
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
      let resp: Hover[] = await commands.executeCommand('vscode.executeHoverProvider', uri, params.symbol.position);
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
    languages.registerCompletionItemProvider({ scheme: 'file', language: 'pax' }, new PaxCompletionItemProvider(), ...['<','.','@',':',"=","#"]);
    languages.registerDefinitionProvider({ scheme: 'file', language: 'pax' }, new PaxDefinitionProvider());
    languages.registerHoverProvider({ scheme: 'file', language: 'pax' }, new PaxHoverProvider());
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
  async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionItem[] | CompletionList> {
    const customResponse: any = await client.sendRequest('textDocument/completion', {
      textDocument: {
        uri: document.uri.toString(),
      },
      position: position,
      context: context
    });

    if (customResponse) {
      for (let item of customResponse) {
        if (item.insertTextFormat == 2) { 
          item.insertText = new SnippetString(item.insertText);
        }
      }
      return customResponse as CompletionItem[];
    }
    return [];
  }
}

class PaxDefinitionProvider implements DefinitionProvider {
  async provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<DefinitionLink[]> {
    const customResponse = await client.sendRequest<number | null>('pax/getDefinitionId', {
        textDocument: {
            uri: document.uri.toString(),
        },
        position: position
    });

    if (typeof customResponse === "number") {
      let path = document.uri.path.toString();
      let data = ( enrichmentProxy.getEnrichmentData(path, EnrichmentType.DEFINITION , customResponse) as LocationLink[]);
      data.forEach((item) => {item.originSelectionRange=undefined;})
      return data;
    }

    return [];
  }
}

class PaxHoverProvider implements HoverProvider {
  async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | undefined> {
    const customResponse = await client.sendRequest<Hover | null>('pax/getHoverId', {
        textDocument: {
            uri: document.uri.toString(),
        },
        position: position
    });

    if (typeof customResponse === "number") {
      let path = document.uri.path.toString();
      let data = (enrichmentProxy.getEnrichmentData(path, EnrichmentType.HOVER , customResponse) as Hover[]);
      if(data.length > 0){
        return new Hover(data[0].contents);
      } 
    }
    return;
  }
}



export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

