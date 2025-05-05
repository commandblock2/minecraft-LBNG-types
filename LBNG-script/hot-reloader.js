"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ScriptManager_1 = require("@jvm/types/net/ccbluex/liquidbounce/script/ScriptManager");
var HttpServer_1 = require("@jvm/types/com/sun/net/httpserver/HttpServer");
var InetSocketAddress_1 = require("@jvm/types/java/net/InetSocketAddress");
var InputStreamReader_1 = require("@jvm/types/java/io/InputStreamReader");
var BufferedReader_1 = require("@jvm/types/java/io/BufferedReader");
var script = registerScript.apply({
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
}, function (mod) {
    var server = null;
    function readBodyAsString(exchange) {
        var inputStream = exchange.getRequestBody();
        var reader = new BufferedReader_1.BufferedReader(new InputStreamReader_1.InputStreamReader(inputStream, "UTF-8"));
        var lines = [];
        var line = null;
        while ((line = reader.readLine()) !== null) {
            lines.push(line);
        }
        reader.close();
        return lines.join("\n");
    }
    function reloadMatchingScripts(idList) {
        try {
            var scripts = ScriptManager_1.ScriptManager.INSTANCE.scripts.toArray();
            var reloaded = [];
            for (var i = 0; i < scripts.length; ++i) {
                var script_ = scripts[i];
                if (script_ == script)
                    continue; // Do not reload ourself xD
                var f = script_.file;
                var filePath = f ? (f.getAbsolutePath ? f.getAbsolutePath() : f.toString()) : "";
                var simpleFile = f ? (f.getName ? f.getName() : "") : "";
                var scriptName = script_.scriptName || "";
                for (var _i = 0, idList_1 = idList; _i < idList_1.length; _i++) {
                    var id = idList_1[_i];
                    if (id === filePath.replace(".js", "") || id === simpleFile.replace(".js", "") || id === scriptName) {
                        // Store enabled module states if re-enable setting is on
                        var enabledModules = [];
                        if (mod.settings.reenableModules.getValue()) {
                            // Access the registered modules field using reflection
                            try {
                                // @ts-expect-error
                                var registeredModulesField = script_.getClass().getDeclaredField("registeredModules");
                                registeredModulesField.setAccessible(true);
                                var modules = registeredModulesField.get(script_);
                                if (modules && modules.toArray) {
                                    var moduleArray = modules.toArray();
                                    for (var _a = 0, moduleArray_1 = moduleArray; _a < moduleArray_1.length; _a++) {
                                        var module_1 = moduleArray_1[_a];
                                        if (module_1.enabled) {
                                            enabledModules.push(module_1.baseKey);
                                        }
                                    }
                                }
                            }
                            catch (e) {
                                Client.displayChatMessage("\u00A7e[HotReload] \u00A7fError accessing modules: ".concat(e));
                            }
                        }
                        // Unload and reload the script
                        ScriptManager_1.ScriptManager.INSTANCE.unloadScript(script_);
                        var reloadedScript = ScriptManager_1.ScriptManager.INSTANCE.loadScript(script_.file, script_.language, script_.debugOptions);
                        reloadedScript.enable();
                        // Re-enable modules if needed
                        if (mod.settings.reenableModules.getValue() && enabledModules.length > 0) {
                            try {
                                // @ts-expect-error
                                var registeredModulesField = reloadedScript.getClass().getDeclaredField("registeredModules");
                                registeredModulesField.setAccessible(true);
                                var modules = registeredModulesField.get(reloadedScript);
                                if (modules && modules.toArray) {
                                    var moduleArray = modules.toArray();
                                    for (var _b = 0, moduleArray_2 = moduleArray; _b < moduleArray_2.length; _b++) {
                                        var module_2 = moduleArray_2[_b];
                                        if (enabledModules.includes(module_2.baseKey)) {
                                            module_2.enable();
                                        }
                                    }
                                }
                                Client.displayChatMessage("\u00A7e[HotReload] \u00A7fRe-enabled ".concat(enabledModules.length, " modules for ").concat(scriptName));
                            }
                            catch (e) {
                                Client.displayChatMessage("\u00A7e[HotReload] \u00A7fError re-enabling modules: ".concat(e));
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
        }
        catch (e) {
            Client.displayChatMessage("\u00A7e[HotReload] \u00A7fError in reloadMatchingScripts: ".concat(e));
            return [];
        }
    }
    function outResp(exchange, code, msg) {
        exchange.sendResponseHeaders(code, msg.length);
        var os = exchange.getResponseBody();
        // @ts-expect-error
        os.write(new java.lang.String(msg).getBytes());
        os.close();
    }
    // Add these at the module level
    var scriptIdsToReload = [];
    var pendingReload = false;
    var pendingExchange = null;
    // Update the reload handler
    mod.on("enable", function () {
        var port = mod.settings.port.getValue();
        try {
            server = HttpServer_1.HttpServer.create(new InetSocketAddress_1.InetSocketAddress(port), 0);
            var reloadHandler = {
                // @ts-expect-error
                handle: function (exchange) {
                    if (exchange.getRequestMethod() === "POST") {
                        var body = readBodyAsString(exchange);
                        var ids = [];
                        try {
                            ids = JSON.parse(body);
                        }
                        catch (_a) {
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
                    }
                    else {
                        exchange.sendResponseHeaders(405, -1);
                        exchange.close();
                    }
                }
            };
            server.createContext("/reload", reloadHandler);
            server.start();
            Client.displayChatMessage("\u00A7e[HotReload] \u00A7fHTTP server started on port ".concat(port, ", POST /reload (with JSON array in body) to reload only updated scripts."));
        }
        catch (e) {
            Client.displayChatMessage("\u00A7e[HotReload] \u00A7fFailed to start HTTP server on port ".concat(port, ": ").concat(e));
        }
    });
    // Add a worldrender event to handle script reloading on the render thread
    mod.on("worldrender", function () {
        if (pendingReload && pendingExchange) {
            try {
                // Now we're on the render thread, it's safe to reload scripts
                var reloaded = reloadMatchingScripts(scriptIdsToReload);
                var resp = reloaded.length > 0
                    ? "Reloaded scripts: ".concat(reloaded.join(", "))
                    : "No matching scripts found to reload. Script ids requested from endpoint: ".concat(scriptIdsToReload);
                // Respond to the HTTP request
                outResp(pendingExchange, 200, resp);
                Client.displayChatMessage("\u00A7e[HotReload] \u00A7f".concat(resp));
            }
            catch (e) {
                if (pendingExchange) {
                    outResp(pendingExchange, 500, "Error: ".concat(e));
                    Client.displayChatMessage("\u00A7e[HotReload] \u00A7fError during reload: ".concat(e));
                }
            }
            finally {
                // Reset the pending state
                pendingReload = false;
                pendingExchange = null;
                scriptIdsToReload = [];
            }
        }
    });
    mod.on("disable", function () {
        if (server !== null) {
            server.stop(0);
            server = null;
            Client.displayChatMessage("§e[HotReload] §fHTTP server stopped.");
        }
    });
});
