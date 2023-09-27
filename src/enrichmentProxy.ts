import { commands, Hover, LocationLink, Uri, Position } from "vscode";
import { SymbolData } from "./extension";

enum EnrichmentType {
    DEFINITION = "getDefinition",
    HOVER = "getHover"
}

interface EnrichmentData {
    [EnrichmentType.DEFINITION]: Map<number, LocationLink[]>,
    [EnrichmentType.HOVER]: Map<number, Hover[]>
}


export interface EnrichParams {
    symbol: SymbolData;
    originatingPaxFile: string;
  }
  

interface EnrichmentResult {
    [EnrichmentType.DEFINITION]?: number,
    [EnrichmentType.HOVER]?: number
}

class EnrichmentProxy {

    private fileMap: Map<string, EnrichmentData>;
    private idCounter: number;

    constructor() {
        this.fileMap = new Map<string, EnrichmentData>();
        this.idCounter = 0;
    }

    async enrich(params: EnrichParams): Promise<EnrichmentResult> {
        const uri = Uri.file(params.symbol.uri);
        const respDefinition: LocationLink[] = await commands.executeCommand('vscode.executeDefinitionProvider', uri, params.symbol.position);
        const respHover: Hover[] = await commands.executeCommand('vscode.executeHoverProvider', uri, params.symbol.position);
    
        if (!this.fileMap.has(params.originatingPaxFile)) {
            this.fileMap.set(params.originatingPaxFile, {
                [EnrichmentType.DEFINITION]: new Map<number, LocationLink[]>(),
                [EnrichmentType.HOVER]: new Map<number, Hover[]>()
            });
        }
    
        const fileData = this.fileMap.get(params.originatingPaxFile);
        const definitionId = this.storeData(fileData![EnrichmentType.DEFINITION], respDefinition);
        const hoverId = this.storeData(fileData![EnrichmentType.HOVER], respHover);
    
        return {
            [EnrichmentType.DEFINITION]: definitionId,
            [EnrichmentType.HOVER]: hoverId
        };
    }
    

    getEnrichmentData(originatingPaxFile: string, type: EnrichmentType, id: number): LocationLink[] | Hover[] | null {
        const fileData = this.fileMap.get(originatingPaxFile);
        if (!fileData) {
            return null;
        }
        return fileData[type].get(id) || null;
    }

    clearDataForFile(originatingPaxFile: string): void {
        this.fileMap.delete(originatingPaxFile);
    }

    clearAllData(): void {
        this.fileMap.clear();
    }

    private storeData<T>(dataMap: Map<number, T>, data: T): number {
        const id = this.getUniqueId();
        dataMap.set(id, data);
        return id;
    }

    private getUniqueId(): number {
        return this.idCounter++;
    }
}

export default EnrichmentProxy;