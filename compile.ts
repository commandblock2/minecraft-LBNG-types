import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// The custom require function to prepend to files
const requireFunction = `
function __require(path) {
    if (path.startsWith("@embedded") || path.startsWith("@minecraft-yarn-definitions")) {
        const javaPath = path
            .replace("@embedded", "net.ccbluex.liquidbounce.script.api")
            .replace("@minecraft-yarn-definitions", "net.minecraft");
        return Java.type(javaPath);
    }
    return require(path);
}\n\n`;


function createTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sourceFile: ts.SourceFile): ts.SourceFile => {
            const visitor = (node: ts.Node): ts.Node => {
                // Handle require calls
                if (ts.isCallExpression(node) && 
                    ts.isIdentifier(node.expression) && 
                    node.expression.text === 'require') {
                    return ts.factory.createCallExpression(
                        ts.factory.createIdentifier('__require'),
                        node.typeArguments,
                        node.arguments
                    );
                }
                
                // Handle import declarations
                if (ts.isImportDeclaration(node)) {
                    const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
                    const importClause = node.importClause;
                    
                    if (importClause && importClause.namedBindings) {
                        if (ts.isNamedImports(importClause.namedBindings)) {
                            // Create a simple variable declaration without namespace
                            const elements = importClause.namedBindings.elements;
                            return ts.factory.createVariableStatement(
                                undefined,
                                ts.factory.createVariableDeclarationList(
                                    elements.map(e => 
                                        ts.factory.createVariableDeclaration(
                                            e.name, // Use the original name without suffix
                                            undefined,
                                            undefined,
                                            ts.factory.createCallExpression(
                                                ts.factory.createIdentifier('__require'),
                                                undefined,
                                                [ts.factory.createStringLiteral(moduleSpecifier)]
                                            )
                                        )
                                    ),
                                    ts.NodeFlags.Const
                                )
                            );
                        } else if (ts.isNamespaceImport(importClause.namedBindings)) {
                            // Handle namespace imports
                            return ts.factory.createVariableStatement(
                                undefined,
                                ts.factory.createVariableDeclarationList(
                                    [ts.factory.createVariableDeclaration(
                                        importClause.namedBindings.name,
                                        undefined,
                                        undefined,
                                        ts.factory.createCallExpression(
                                            ts.factory.createIdentifier('__require'),
                                            undefined,
                                            [ts.factory.createStringLiteral(moduleSpecifier)]
                                        )
                                    )],
                                    ts.NodeFlags.Const
                                )
                            );
                        }
                    } else if (importClause?.name) {
                        // Handle default imports
                        return ts.factory.createVariableStatement(
                            undefined,
                            ts.factory.createVariableDeclarationList(
                                [ts.factory.createVariableDeclaration(
                                    importClause.name,
                                    undefined,
                                    undefined,
                                    ts.factory.createCallExpression(
                                        ts.factory.createIdentifier('__require'),
                                        undefined,
                                        [ts.factory.createStringLiteral(moduleSpecifier)]
                                    )
                                )],
                                ts.NodeFlags.Const
                            )
                        );
                    }
                }

                // Handle property access expressions (remove namespace access)
                if (ts.isPropertyAccessExpression(node) &&
                    ts.isIdentifier(node.expression) &&
                    node.expression.text.match(/.*_\d+$/)) {  // Match any _number suffix
                    return node.name;
                }

                // Handle variable declarations to remove _1 suffix
                if (ts.isVariableDeclaration(node) &&
                    ts.isIdentifier(node.name) &&
                    node.name.text.match(/.*_\d+$/)) {
                    return ts.factory.createVariableDeclaration(
                        ts.factory.createIdentifier(node.name.text.replace(/_\d+$/, '')),
                        node.exclamationToken,
                        node.type,
                        node.initializer
                    );
                }
                
                return ts.visitEachChild(node, visitor, context);
            };
            
            return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
        };
    };
}


function compile(fileNames: string[], options: ts.CompilerOptions): void {
    const program = ts.createProgram(fileNames, options);
    const transformer = createTransformer();

    fileNames.forEach(fileName => {
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) return;

        // First let TypeScript emit the file with its default transformers
        const emitResult = program.emit(
            sourceFile, 
            (outputPath, outputText) => {
                // Now apply our custom transformer to the emitted JavaScript
                const transformedSource = ts.createSourceFile(
                    outputPath,
                    outputText,
                    ts.ScriptTarget.Latest,
                    true
                );
                
                const result = ts.transform(transformedSource, [transformer]);
                const printer = ts.createPrinter();
                const transformedText = printer.printFile(result.transformed[0]);
                
                // Write the final result with our __require function prepended
                fs.writeFileSync(outputPath, requireFunction + transformedText);
                
                result.dispose();
            },
            undefined,
            false
        );

        if (emitResult.emitSkipped) {
            throw new Error(`Emission failed for ${fileName}`);
        }
    });
}

// Get tsconfig.json
const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
if (!configPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.");
}

const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
const { options, fileNames } = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    path.dirname(configPath)
);

compile(fileNames, options);