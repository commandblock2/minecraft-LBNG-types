import { CommonPingS2CPacket } from "jvm-types/net/minecraft/network/packet/s2c/common/CommonPingS2CPacket";


// Define the TransactionEntry interface for storing packet data
interface TransactionEntry {
    timestamp: number;
    parameter: number;
}

// Global variables for storing transaction data
const transactionQueue: TransactionEntry[] = [];
const MAX_QUEUE_SIZE = 1000;

// Global statistics
let totalTransactions = 0;
let lastReportTime = 0;
const PARAMETER_FREQUENCY: { [key: number]: number } = {};

const script = registerScript.apply({
    name: "transactions",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "transactions",
    description: "Logs transactions packets for anticheat detection",
    category: "Client",
    settings: {
        reportInterval: Setting.int({
            name: "ReportInterval",
            default: 5,
            range: [1, 60],
            suffix: "seconds"
        }),
        showParameters: Setting.boolean({
            name: "ShowParameters",
            default: true
        }),
        logToChat: Setting.boolean({
            name: "LogToChat",
            default: true
        }),
        verbose: Setting.boolean({
            name: "Verbose",
            default: false
        })
    }
}, (mod) => {
    mod.on("enable", () => {
        // Reset statistics
        totalTransactions = 0;
        lastReportTime = Date.now();
        
        // Clear the queue
        transactionQueue.length = 0;
        
        // Reset parameter frequency
        for (const key in PARAMETER_FREQUENCY) {
            delete PARAMETER_FREQUENCY[key];
        }
        
        Client.displayChatMessage("§a[Transactions] Monitoring started. Use .txstats to see statistics.");
    });

    mod.on("disable", () => {
        Client.displayChatMessage("§c[Transactions] Monitoring stopped.");
    });

    mod.on("packet", (event) => {
        if (event.packet instanceof CommonPingS2CPacket) {
            const parameter = event.packet.getParameter();
            const timestamp = Date.now();

            if (mod.settings.verbose.getValue()) {
                Client.displayChatMessage(`§a[Transactions] Received parameter: ${parameter}`);
            }
            
            // Add to queue
            transactionQueue.push({ timestamp, parameter });
            
            // Keep queue size limited
            if (transactionQueue.length > MAX_QUEUE_SIZE) {
                transactionQueue.shift();
            }
            
            // Update statistics
            totalTransactions++;
            PARAMETER_FREQUENCY[parameter] = (PARAMETER_FREQUENCY[parameter] || 0) + 1;
            
            // Check if it's time to report
            const currentTime = Date.now();
            const reportIntervalMs = mod.settings.reportInterval.getValue() * 1000;
            
            if (mod.settings.logToChat.getValue() && currentTime - lastReportTime >= reportIntervalMs) {
                reportStatistics();
                lastReportTime = currentTime;
            }
        }
    });
    
    // Function to report statistics
    function reportStatistics() {
        if (transactionQueue.length === 0) {
            return;
        }
        
        const packetsPerSecond = calculatePacketsPerSecond();
        Client.displayChatMessage(`§e[Transactions] §fRate: §a${packetsPerSecond.toFixed(2)} §fpackets/sec | Total: §a${totalTransactions}`);
        
        if (mod.settings.showParameters.getValue()) {
            const topParameters = getTopParameters(8);
            if (topParameters.length > 0) {
                Client.displayChatMessage(`§e[Transactions] §fTop parameters: ${topParameters.map(p => `§a${p.parameter}§f(${p.count})`).join(", ")}`);
            }
        }
    }
    
    // Calculate packets per second based on queue data
    function calculatePacketsPerSecond(): number {
        if (transactionQueue.length < 2) {
            return 0;
        }
        
        const oldestTimestamp = transactionQueue[0].timestamp;
        const newestTimestamp = transactionQueue[transactionQueue.length - 1].timestamp;
        const timeSpanSeconds = (newestTimestamp - oldestTimestamp) / 1000;
        
        return timeSpanSeconds > 0 ? transactionQueue.length / timeSpanSeconds : 0;
    }
    
    // Get top N most frequent parameters
    function getTopParameters(n: number): { parameter: number, count: number }[] {
        return Object.entries(PARAMETER_FREQUENCY)
            .map(([parameter, count]) => ({ parameter: parseInt(parameter), count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, n);
    }
});

// Register a command to view transaction statistics
script.registerCommand({
    name: "txstats",
    aliases: ["transactionstats"],
    parameters: [{
        name: "action",
        required: false,
        validate: ParameterValidator.string
    }],
    onExecute(action: string) {
        if (action === "clear") {
            // Clear statistics
            totalTransactions = 0;
            transactionQueue.length = 0;
            for (const key in PARAMETER_FREQUENCY) {
                delete PARAMETER_FREQUENCY[key];
            }
            Client.displayChatMessage("§a[Transactions] Statistics cleared.");
            return;
        }
        
        if (transactionQueue.length === 0) {
            Client.displayChatMessage("§c[Transactions] No transaction data available.");
            return;
        }
        
        // Display basic statistics
        const packetsPerSecond = calculatePacketsPerSecond();
        Client.displayChatMessage(`§e[Transactions] §fStatistics:`);
        Client.displayChatMessage(`§fTotal transactions: §a${totalTransactions}`);
        Client.displayChatMessage(`§fCurrent rate: §a${packetsPerSecond.toFixed(2)} §fpackets/sec`);
        
        // Display queue info
        Client.displayChatMessage(`§fQueue size: §a${transactionQueue.length}/${MAX_QUEUE_SIZE}`);
        
        // Display top 5 parameters
        const topParameters = getTopParameters(5);
        if (topParameters.length > 0) {
            Client.displayChatMessage(`§fTop 5 parameters:`);
            topParameters.forEach((p, index) => {
                Client.displayChatMessage(`§f  ${index + 1}. Parameter §a${p.parameter}§f: ${p.count} occurrences (${(p.count / totalTransactions * 100).toFixed(1)}%)`);
            });
        }
        
        // Display time range
        if (transactionQueue.length >= 2) {
            const oldestTimestamp = transactionQueue[0].timestamp;
            const newestTimestamp = transactionQueue[transactionQueue.length - 1].timestamp;
            const timeSpanSeconds = (newestTimestamp - oldestTimestamp) / 1000;
            Client.displayChatMessage(`§fTime span: §a${timeSpanSeconds.toFixed(2)} §fseconds`);
        }
    }
});

// Helper functions for command execution
function calculatePacketsPerSecond(): number {
    if (transactionQueue.length < 2) {
        return 0;
    }
    
    const oldestTimestamp = transactionQueue[0].timestamp;
    const newestTimestamp = transactionQueue[transactionQueue.length - 1].timestamp;
    const timeSpanSeconds = (newestTimestamp - oldestTimestamp) / 1000;
    
    return timeSpanSeconds > 0 ? transactionQueue.length / timeSpanSeconds : 0;
}

function getTopParameters(n: number): { parameter: number, count: number }[] {
    return Object.entries(PARAMETER_FREQUENCY)
        .map(([parameter, count]) => ({ parameter: parseInt(parameter), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n);
}
