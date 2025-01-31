import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// The custom require function to prepend to files
const requireFunction = `

function __require(path) {
    if (path.startsWith("@embedded")) {
        return {
            _embedded: globalThis
        }
    }

    if (path.startsWith("@minecraft-yarn-definitions/types/")) {
        return {
            [path.substring(path.lastIndexOf("/") + 1)]: Java.type(path
                .replaceAll("@minecraft-yarn-definitions/types/", "")
                .replaceAll("/", ".")
            )
        }
    }
    return require(path);
}
var exports = {}

`;


function createTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        // Keep track of transformed identifiers
        const transformedIdentifiers = new Map<string, string>();
        
        const createVisitor = (isSecondPass: boolean) => (node: ts.Node): ts.Node => {
            // First pass: Handle require statements and record transformations
            if (!isSecondPass && ts.isVariableStatement(node)) {
                const declarations = node.declarationList.declarations;
                
                const newDeclarations = declarations.map(decl => {
                    if (decl.initializer && 
                        ts.isCallExpression(decl.initializer) &&
                        ts.isIdentifier(decl.initializer.expression) &&
                        decl.initializer.expression.text === 'require') {
                        
                        // Extract the module name and record the transformation
                        const originalName = (decl.name as ts.Identifier).text;
                        const moduleName = originalName.replace(/_(\d+)?$/, '');
                        transformedIdentifiers.set(originalName, moduleName);
                        
                        return ts.factory.createVariableDeclaration(
                            ts.factory.createObjectBindingPattern([
                                ts.factory.createBindingElement(
                                    undefined,
                                    undefined,
                                    ts.factory.createIdentifier(moduleName),
                                    undefined
                                )
                            ]),
                            undefined,
                            undefined,
                            ts.factory.createCallExpression(
                                ts.factory.createIdentifier('__require'),
                                undefined,
                                decl.initializer.arguments
                            )
                        );
                    }
                    return decl;
                });

                return ts.factory.createVariableStatement(
                    undefined,
                    ts.factory.createVariableDeclarationList(
                        newDeclarations,
                        ts.NodeFlags.Const
                    )
                );
            }
            
            // Second pass: Clean up transformed references
            if (isSecondPass) {
                // Handle property access like _embedded_1.registerScript
                if (ts.isPropertyAccessExpression(node)) {
                    const expression = node.expression;
                    if (ts.isIdentifier(expression)) {
                        const transformedName = transformedIdentifiers.get(expression.text);
                        if (transformedName) {
                            return ts.factory.createPropertyAccessExpression(
                                ts.factory.createIdentifier(transformedName),
                                node.name
                            );
                        }
                    }
                }
                
                // Handle new expressions like new ScriptModule_1.ScriptModule
                if (ts.isNewExpression(node)) {
                    if (ts.isPropertyAccessExpression(node.expression)) {
                        const expression = node.expression.expression;
                        if (ts.isIdentifier(expression)) {
                            const transformedName = transformedIdentifiers.get(expression.text);
                            if (transformedName) {
                                return ts.factory.createNewExpression(
                                    ts.factory.createIdentifier(node.expression.name.text),
                                    node.typeArguments,
                                    node.arguments
                                );
                            }
                        }
                    }
                }
            }
            
            return ts.visitEachChild(node, createVisitor(isSecondPass), context);
        };
        
        return (sourceFile: ts.SourceFile): ts.SourceFile => {
            // First pass: Transform requires and record changes
            let result = ts.visitNode(sourceFile, createVisitor(false)) as ts.SourceFile;
            // Second pass: Clean up references
            result = ts.visitNode(result, createVisitor(true)) as ts.SourceFile;
            return result;
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