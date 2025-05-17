import { ScriptManager } from "jvm-types/net/ccbluex/liquidbounce/script/ScriptManager";
import { HttpServer } from "jvm-types/com/sun/net/httpserver/HttpServer";
import { InetSocketAddress } from "jvm-types/java/net/InetSocketAddress";
import { HttpHandler } from "jvm-types/com/sun/net/httpserver/HttpHandler";
import { HttpExchange } from "jvm-types/com/sun/net/httpserver/HttpExchange";
import { InputStream } from "jvm-types/java/io/InputStream";
import { InputStreamReader } from "jvm-types/java/io/InputStreamReader";
import { BufferedReader } from "jvm-types/java/io/BufferedReader";
import { Unit } from "jvm-types/kotlin/Unit";
import { PolyglotScript } from "jvm-types/net/ccbluex/liquidbounce/script/PolyglotScript";
import { Function0 } from "jvm-types/kotlin/jvm/functions/Function0";
import { ClientModule } from "jvm-types/net/ccbluex/liquidbounce/features/module/ClientModule";

const script = registerScript.apply({
    name: "hot-reloader",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "ScriptHotReloader",
    description: "Reloads updated scripts on HTTP POST to /reload (send JSON array of updated script names/paths).",
    category: "Client",
    settings: {
        port: Setting.int({
            name: "Port",
            default: 18470,
            range: [1024, 65535],
            suffix: ""
        }),
        reenableModules: Setting.boolean({
            name: "Reenable Modules",
            default: true,
        })

    },
}, (mod) => {
    let server: HttpServer | null = null;

    function readBodyAsString(exchange: HttpExchange): string {
        const inputStream: InputStream = exchange.getRequestBody();
        const reader = new BufferedReader(new InputStreamReader(inputStream, "UTF-8"));
        let lines: string[] = [];
        let line: string | null = null;
        while ((line = reader.readLine()) !== null) {
            lines.push(line);
        }
        reader.close();
        return lines.join("\n");
    }

    function reloadMatchingScripts(idList: string[]): string[] {
        try {
            const scripts = (ScriptManager.INSTANCE.scripts as any).toArray() as Array<PolyglotScript>;
            const reloaded: string[] = [];
            for (let i = 0; i < scripts.length; ++i) {
                const script_ = scripts[i];
    
                if (script_ == script)
                    continue; // Do not reload ourself xD
    
                const f = script_.file;
                const filePath = f ? (f.getAbsolutePath ? f.getAbsolutePath() : f.toString()) : "";
                const simpleFile = f ? (f.getName ? f.getName() : "") : "";
                const scriptName = script_.scriptName || "";
                for (let id of idList) {
                    if (id === filePath.replace(".js", "") || id === simpleFile.replace(".js", "") || id === scriptName) {
                        // Store enabled module states if re-enable setting is on
                        const enabledModules: string[] = [];
                        if (mod.settings.reenableModules.getValue()) {
                            // Access the registered modules field using reflection
                            try {
                                // @ts-expect-error
                                const registeredModulesField = script_.getClass().getDeclaredField("registeredModules");
                                registeredModulesField.setAccessible(true);
                                const modules = registeredModulesField.get(script_) as any;
                                
                                if (modules && modules.toArray) {
                                    const moduleArray = modules.toArray() as Array<ClientModule>;
                                    for (const module of moduleArray) {
                                        if (module.enabled) {
                                            enabledModules.push(module.baseKey);
                                        }
                                    }
                                }
                            } catch (e) {
                                Client.displayChatMessage(`§e[HotReload] §fError accessing modules: ${e}`);
                            }
                        }
                        
                        // Unload and reload the script
                        ScriptManager.INSTANCE.unloadScript(script_);
                        const reloadedScript = ScriptManager.INSTANCE.loadScript(script_.file, script_.language, script_.debugOptions);
                        reloadedScript.enable();
                        
                        // Re-enable modules if needed
                        if (mod.settings.reenableModules.getValue() && enabledModules.length > 0) {
                            try {
                                // @ts-expect-error
                                const registeredModulesField = reloadedScript.getClass().getDeclaredField("registeredModules");
                                registeredModulesField.setAccessible(true);
                                const modules = registeredModulesField.get(reloadedScript) as any;
                                
                                if (modules && modules.toArray) {
                                    const moduleArray = modules.toArray() as Array<ClientModule>;
                                    for (const module of moduleArray) {
                                        if (enabledModules.includes(module.baseKey)) {
                                            module.enable();
                                        }
                                    }
                                }
                                
                                Client.displayChatMessage(`§e[HotReload] §fRe-enabled ${enabledModules.length} modules for ${scriptName}`);
                            } catch (e) {
                                Client.displayChatMessage(`§e[HotReload] §fError re-enabling modules: ${e}`);
                            }
                        }
                        // For this part claude-3-7 out smarted me, 
                        // I on my own removed that part and stored the client modules objects are an array I was trying to simply re-enable those modules directly
                        // but after reloading the script the original client modules were gc'ed
                        // so there will be `org.graalvm.polyglot.PolyglotException: Context execution was cancelled.`
                        
                        reloaded.push(scriptName || simpleFile || filePath);
                        break;
                    }
                }
            }
            return reloaded;
        } catch (e) {
            Client.displayChatMessage(`§e[HotReload] §fError in reloadMatchingScripts: ${e}`);
            return [];
        }
    }
    

    function outResp(exchange: HttpExchange, code: number, msg: string) {
        exchange.sendResponseHeaders(code, msg.length);
        const os = exchange.getResponseBody();
        // @ts-expect-error
        os.write(new java.lang.String(msg).getBytes());
        os.close();
    }

    // Add these at the module level
    let scriptIdsToReload: string[] = [];
    let pendingReload = false;
    let pendingExchange: HttpExchange | null = null;

    // Update the reload handler
    mod.on("enable", () => {
        const port = mod.settings.port.getValue();

        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);
            const reloadHandler: HttpHandler = {
                // @ts-expect-error
                handle: (exchange: HttpExchange) => {
                    if (exchange.getRequestMethod() === "POST") {
                        const body = readBodyAsString(exchange);
                        let ids: string[] = [];
                        try {
                            ids = JSON.parse(body);
                        } catch {
                            outResp(exchange, 400, "Invalid JSON array.");
                            Client.displayChatMessage("§e[HotReload] §fReceived malformed POST to /reload (not a JSON array)");
                            return;
                        }
                        if (!Array.isArray(ids) || ids.length === 0) {
                            outResp(exchange, 200, "No scripts to reload.");
                            return;
                        }

                        // Queue the reload request for the render thread
                        scriptIdsToReload = ids;
                        pendingReload = true;
                        pendingExchange = exchange;

                        // Inform user that reload is pending
                        Client.displayChatMessage("§e[HotReload] §fScript reload request queued for next render frame");
                    } else {
                        exchange.sendResponseHeaders(405, -1);
                        exchange.close();
                    }
                }
            };
            server.createContext("/reload", reloadHandler);
            server.start();
            Client.displayChatMessage(`§e[HotReload] §fHTTP server started on port ${port}, POST /reload (with JSON array in body) to reload only updated scripts.`);
        } catch (e) {
            Client.displayChatMessage(`§e[HotReload] §fFailed to start HTTP server on port ${port}: ${e}`);
        }
    });

    // Add a worldrender event to handle script reloading on the render thread
    mod.on("worldrender", () => {
        if (pendingReload && pendingExchange) {
            try {
                // Now we're on the render thread, it's safe to reload scripts
                const reloaded = reloadMatchingScripts(scriptIdsToReload);
                const resp = reloaded.length > 0
                    ? `Reloaded scripts: ${reloaded.join(", ")}`
                    : `No matching scripts found to reload. Script ids requested from endpoint: ${scriptIdsToReload}`;

                // Respond to the HTTP request
                outResp(pendingExchange, 200, resp);
                Client.displayChatMessage(`§e[HotReload] §f${resp}`);
            } catch (e) {
                if (pendingExchange) {
                    outResp(pendingExchange, 500, `Error: ${e}`);
                    Client.displayChatMessage(`§e[HotReload] §fError during reload: ${e}`);
                }
            } finally {
                // Reset the pending state
                pendingReload = false;
                pendingExchange = null;
                scriptIdsToReload = [];
            }
        }
    });

    mod.on("disable", () => {
        if (server !== null) {
            server.stop(0);
            server = null;
            Client.displayChatMessage("§e[HotReload] §fHTTP server stopped.");
        }
    });
});
