import * as path from 'path';
import * as chokidar from 'chokidar';

/**
 * A simple file watcher that sends hot reload requests when files change
 */
async function watchDirectoryForHotReload(dirPath: string, options: {
    port?: number,
    extensions?: string[],
    debounceMs?: number
} = {}) {
    // --- Hot-reload configuration ---
    // Default port is 18470, can be overridden with env var or CLI args
    let reloadPort = options.port || 18470;
    const fileExtensions = options.extensions || ['.ts', '.tsx', '.js', '.jsx'];
    const debounceTime = options.debounceMs || 250;

    // Allow override via command line args
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; ++i) {
        if (args[i].startsWith('--hot-reload-port')) {
            const split = args[i].split('=');
            if (split.length === 2) {
                reloadPort = parseInt(split[1], 10);
            } else if (args[i + 1]) {
                reloadPort = parseInt(args[i + 1], 10);
            }
        }
    }

    // Allow override via env var
    if (process.env.HOT_RELOAD_PORT) {
        reloadPort = parseInt(process.env.HOT_RELOAD_PORT, 10);
    }

    const reloadUrl = `http://127.0.0.1:${reloadPort}/reload`;

    /**
     * Trigger the hot-reloader server to reload just-updated files
     * @param {string[]} changedFilePaths - List of changed source file paths
     */
    async function triggerHotReload(changedFilePaths: string[]) {
        if (!changedFilePaths || changedFilePaths.length === 0) return;

        // Match the contract of hot-reloader: send JSON array of file paths and filenames
        const idSet = new Set<string>();
        for (const f of changedFilePaths) {
            idSet.add(path.resolve(f));
            idSet.add(path.basename(f, path.extname(f)));
        }

        const idList = Array.from(idSet);
        try {
            const body = JSON.stringify(idList);

            // Prefer node "fetch" API (Node 18+) but fallback to http.request
            if (typeof fetch === 'function') {
                const res = await fetch(reloadUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                });
                const txt = await res.text();
                console.log(`[hot-reload] HTTP POST /reload: ${res.status} ${txt}`);
            } else {
                // Fallback minimal http request
                const http = require('http');
                const urlObj = new URL(reloadUrl);
                const req = http.request(
                    {
                        host: urlObj.hostname,
                        port: urlObj.port,
                        path: urlObj.pathname,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(body),
                        },
                    },
                    (res: any) => {
                        let data = '';
                        res.on('data', (chunk: any) => (data += chunk));
                        res.on('end', () => {
                            console.log(`[hot-reload] HTTP POST /reload: ${res.statusCode} ${data}`);
                        });
                    }
                );
                req.on('error', (err: any) => {
                    console.warn(`[hot-reload] Could not reach hot-reloader (${reloadUrl}): ${err}`);
                });
                req.write(body);
                req.end();
            }
        } catch (err) {
            console.warn(`[hot-reload] Error sending HTTP reload request: ${err}`);
        }
    }

    console.log(`\nWatch mode enabled. Watching directory: ${dirPath}`);
    console.log(`Hot reload server: ${reloadUrl}`);
    console.log(`File extensions: ${fileExtensions.join(', ')}`);

    // Set up a watcher for the specified directory
    const watcher = chokidar.watch(dirPath, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
    });

    // Track changed files for batched reload notifications
    let changedFiles = new Set<string>();
    let timeoutId: NodeJS.Timeout | null = null;

    // Function to handle file changes with debounce
    const handleChange = (filePath: string) => {
        if (fileExtensions.includes(path.extname(filePath))) {
            const absolutePath = path.resolve(filePath);
            changedFiles.add(absolutePath);

            // Clear existing timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Set a new timeout to trigger hot reload after changes settle
            timeoutId = setTimeout(() => {
                // Make a copy of changedFiles for this reload pass
                const justChanged = Array.from(changedFiles);
                changedFiles.clear();
                timeoutId = null;

                // Notify server of file changes
                triggerHotReload(justChanged);
                console.log('\nWaiting for file changes...');
            }, debounceTime);
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

// Parse command line arguments
const args = process.argv.slice(2);
const directoryToWatch = args[0] || './dist';  // Default to dist directory if none specified

// Start the watcher
watchDirectoryForHotReload(directoryToWatch, {
    // Default options can be overridden via command line args
    port: 18470,
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.html'],
    debounceMs: 250
});