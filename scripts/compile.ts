import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// The custom require function to prepend to files
const requireFunction = `

function __require(path) {
    if (path.startsWith("@embedded")) {
        return globalThis
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
        const visitor = (node: ts.Node): ts.Node => {
            if (ts.isCallExpression(node)) {
                const expression = node.expression;
                if (ts.isIdentifier(expression) && expression.text === 'require') {
                    const newExpression = ts.factory.createIdentifier('__require');
                    return ts.factory.updateCallExpression(
                        node,
                        newExpression,
                        node.typeArguments,
                        node.arguments
                    );
                }
            }
            return ts.visitEachChild(node, visitor, context);
        };

        return (sourceFile: ts.SourceFile) => {
            return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
        };
    };
}



function compile(fileNames: string[], options: ts.CompilerOptions): void {

    const sourceMapOptions: ts.CompilerOptions = {
        ...options,
        sourceMap: true,
        inlineSourceMap: false,
        inlineSources: true,
        sourceRoot: 'src'
    };


    const program = ts.createProgram(fileNames, sourceMapOptions);
    const transformer = createTransformer();

    fileNames.forEach(fileName => {
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) return;

        // First let TypeScript emit the file with its default transformers
        const emitResult = program.emit(
            sourceFile,
            (fileName: string, text: string, _writeByteOrderMark: boolean, _onError?: (message: string) => void, sourceFiles?: readonly ts.SourceFile[]) => {
                // Handle source map cases
                if (fileName.endsWith('.js.map')) {
                    // Parse and modify the source map
                    const sourceMap = JSON.parse(text) as { sourceRoot: string };
                    sourceMap.sourceRoot = 'src';
                    fs.writeFileSync(fileName, JSON.stringify(sourceMap));
                    return;
                }

                if (fileName.endsWith('.js')) {
                    // Add source map reference
                    text = text + `\n//# sourceMappingURL=${path.basename(fileName)}.map`;

                    const transformedSource = ts.createSourceFile(
                        fileName,
                        text,
                        ts.ScriptTarget.Latest,
                        true
                    );

                    const result = ts.transform(transformedSource, [transformer]);
                    const printer = ts.createPrinter();
                    const transformedText = printer.printFile(result.transformed[0]);

                    // Write the final JS with require function
                    fs.writeFileSync(fileName, requireFunction + transformedText);

                    result.dispose();
                }
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