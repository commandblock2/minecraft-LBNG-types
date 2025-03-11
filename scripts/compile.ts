import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';

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

function compile(fileNames: string[], options: ts.CompilerOptions, changedFiles?: Set<string>): void {
    console.log('Compiling...');
    
    const startTime = Date.now();
    const sourceMapOptions: ts.CompilerOptions = {
        ...options,
        sourceMap: true,
        inlineSourceMap: false,
        inlineSources: true,
        sourceRoot: 'src'
    };

    const program = ts.createProgram(fileNames, sourceMapOptions);
    const transformer = createTransformer();

    // Filter for only changed files if in watch mode and changedFiles is provided
    const filesToCompile = changedFiles ? 
        fileNames.filter(file => changedFiles.has(file)) : 
        fileNames;

    filesToCompile.forEach(fileName => {
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
            console.error(`Emission failed for ${fileName}`);
        }
    });

    // Get and report any errors
    const allDiagnostics = ts.getPreEmitDiagnostics(program);
    if (allDiagnostics.length > 0) {
        allDiagnostics.forEach(diagnostic => {
            if (diagnostic.file) {
                const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
            } else {
                console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
            }
        });
    } else {
        const endTime = Date.now();
        console.log(`Compilation completed successfully in ${endTime - startTime}ms`);
    }
}

function watchMode(fileNames: string[], options: ts.CompilerOptions) {
    // Initial compilation
    compile(fileNames, options);
    
    console.log('\nWatch mode enabled. Waiting for file changes...');
    
    // Get source directories from fileNames
    const sourceDirs = new Set(fileNames.map(fileName => path.dirname(fileName)));
    const sourceFileExtensions = ['.ts', '.tsx'];
    
    // Set up a watcher for TypeScript files
    const watcher = chokidar.watch(Array.from(sourceDirs), {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
    });
    
    // Track changed files for batched compilation
    let changedFiles = new Set<string>();
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Function to handle file changes with debounce
    const handleChange = (filePath: string) => {
        if (sourceFileExtensions.includes(path.extname(filePath))) {
            const absolutePath = path.resolve(filePath);
            changedFiles.add(absolutePath);
            
            // Clear existing timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            // Set a new timeout to compile after changes settle
            timeoutId = setTimeout(() => {
                compile(fileNames, options, changedFiles);
                changedFiles.clear();
                timeoutId = null;
                console.log('\nWaiting for file changes...');
            }, 250);
        }
    };
    
    // Watch for changes
    watcher
        .on('change', (filePath) => {
            console.log(`File changed: ${filePath}`);
            handleChange(filePath);
        })
        .on('add', (filePath) => {
            console.log(`File added: ${filePath}`);
            handleChange(filePath);
        });
        
    // Handle process termination
    process.on('SIGINT', () => {
        console.log('Watch mode terminated');
        watcher.close();
        process.exit(0);
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

// Check for --watch or -w flag
const args = process.argv.slice(2);
const watchFlag = args.includes('--watch') || args.includes('-w');

if (watchFlag) {
    watchMode(fileNames, options);
} else {
    compile(fileNames, options);
}
