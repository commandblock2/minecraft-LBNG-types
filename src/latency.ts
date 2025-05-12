// Import packet types for detection
import { PlayerInteractBlockC2SPacket } from "@jvm/types/net/minecraft/network/packet/c2s/play/PlayerInteractBlockC2SPacket";
import { BlockUpdateS2CPacket } from "@jvm/types/net/minecraft/network/packet/s2c/play/BlockUpdateS2CPacket";
import { BlockPos as BlockPosType } from "@jvm/types/net/minecraft/util/math/BlockPos";
import { TransferOrigin } from "@jvm/types/net/ccbluex/liquidbounce/event/events/TransferOrigin";
import { PacketEvent } from "@jvm/types/net/ccbluex/liquidbounce/event/events/PacketEvent";

/**
 * Interface for tracking latency measurements
 */
interface LatencyMeasurement {
    timestamp: number;
    blockPos: BlockPosType;
    matched: boolean;
    timeout: boolean;
}

/**
 * Class for monitoring and tracking latency measurements
 */
class LatencyMonitor {
    // Configuration
    private MAX_WINDOW_SIZE = 50;          // Maximum pending measurements to track
    private MAX_MEASUREMENTS = 100;         // Maximum completed measurements to keep
    private DEFAULT_TIMEOUT = 5000;        // Default timeout in ms (5 seconds)
    private EMA_ALPHA = 0.2;               // EMA weight for new values (0-1)

    // State tracking
    private pendingMeasurements: LatencyMeasurement[] = [];
    private completedMeasurements: number[] = [];
    private currentTimeout = this.DEFAULT_TIMEOUT;
    private currentEMA = 0;
    private lastDisplayTime = 0;
    private displayFrequency = 5000;       // How often to show HUD updates in ms
    private lastInteractionPos: BlockPosType | null = null;
    private lastInteractionTime = 0;
    private interactionCooldown = 250; // ms

    /**
     * Track outgoing block interaction
     */
    public trackOutgoingInteraction(blockPos: BlockPosType): void {
        const now = Date.now();
        this.cleanupTimeouts();

        // Check for rapid clicks on the same block
        if (this.lastInteractionPos &&
            this.blockPosEquals(this.lastInteractionPos, blockPos) &&
            now - this.lastInteractionTime < this.interactionCooldown) {
            // Skip this interaction to avoid measuring the same update multiple times
            return;
        }

        // Add to pending window
        this.pendingMeasurements.push({
            timestamp: now,
            blockPos: blockPos,
            matched: false,
            timeout: false
        });

        // Update last interaction info
        this.lastInteractionPos = blockPos;
        this.lastInteractionTime = now;

        // Maintain window size
        if (this.pendingMeasurements.length > this.MAX_WINDOW_SIZE) {
            this.pendingMeasurements.shift();
        }
    }

    /**
     * Match incoming block update
     */
    public matchIncomingBlockUpdate(blockPos: BlockPosType): boolean {
        const now = Date.now();
        this.cleanupTimeouts();

        // Defensive check to make sure pendingMeasurements is an array
        if (!Array.isArray(this.pendingMeasurements)) {
            this.pendingMeasurements = [];
            return false;
        }

        // Find matching measurement
        for (let i = 0; i < this.pendingMeasurements.length; i++) {
            const measurement = this.pendingMeasurements[i];
            
            // Skip if measurement is undefined or null
            if (!measurement) continue;

            // Skip already matched or timed out
            if (measurement.matched || measurement.timeout) continue;

            // Match by block position
            if (this.blockPosEquals(measurement.blockPos, blockPos)) {
                const latency = now - measurement.timestamp;
                measurement.matched = true;

                // Add to completed and update stats
                this.addCompletedMeasurement(latency);
                this.updateAdaptiveTimeout();

                // Check if we should display latency
                if (now - this.lastDisplayTime > this.displayFrequency) {
                    this.displayLatency();
                    this.lastDisplayTime = now;
                }

                return true;
            }
        }

        return false; // No match found
    }

    /**
     * Clean up timed out measurements
     */
    private cleanupTimeouts(): void {
        const now = Date.now();
        let timedOutCount = 0;

        // Guard against pendingMeasurements not being an array
        if (!Array.isArray(this.pendingMeasurements)) {
            this.pendingMeasurements = [];
            return;
        }

        // Use forEach with a check for each item
        this.pendingMeasurements.forEach(measurement => {
            if (measurement && !measurement.matched && !measurement.timeout) {
                if (now - measurement.timestamp > this.currentTimeout) {
                    measurement.timeout = true;
                    timedOutCount++;
                }
            }
        });

        // If we have too many timeouts, we might need to adjust the timeout
        if (timedOutCount > 5 && this.completedMeasurements.length > 0) {
            // Increase timeout by 25% if we're seeing a lot of timeouts
            this.currentTimeout = Math.min(this.currentTimeout * 1.25, 10000);
        }
    }

    /**
     * Add completed measurement
     */
    private addCompletedMeasurement(latency: number): void {
        // Ignore unreasonably high values (likely errors)
        if (latency > 10000) return;

        // Ensure completedMeasurements is an array
        if (!Array.isArray(this.completedMeasurements)) {
            this.completedMeasurements = [];
        }

        this.completedMeasurements.push(latency);

        // Maintain array size
        if (this.completedMeasurements.length > this.MAX_MEASUREMENTS) {
            this.completedMeasurements.shift();
        }

        // Update EMA
        if (this.currentEMA === 0) {
            this.currentEMA = latency;
        } else {
            this.currentEMA = (this.EMA_ALPHA * latency) +
                ((1 - this.EMA_ALPHA) * this.currentEMA);
        }
    }

    /**
     * Update adaptive timeout
     */
    private updateAdaptiveTimeout(): void {
        if (!Array.isArray(this.completedMeasurements) || this.completedMeasurements.length < 5) {
            return;
        }

        // Calculate mean and std deviation
        const sum = this.completedMeasurements.reduce((a, b) => a + b, 0);
        const mean = sum / this.completedMeasurements.length;

        const variance = this.completedMeasurements.reduce(
            (sum, val) => sum + Math.pow(val - mean, 2), 0
        ) / this.completedMeasurements.length;

        const stdDev = Math.sqrt(variance);

        // Set timeout to mean + 3 standard deviations (with limits)
        this.currentTimeout = Math.min(
            Math.max(mean + (3 * stdDev), 1000),
            10000
        );
    }

    /**
     * Compare BlockPos objects
     */
    private blockPosEquals(pos1: BlockPosType, pos2: BlockPosType): boolean {
        // Defensive check against null or undefined positions
        if (!pos1 || !pos2) return false;
        
        try {
            return pos1.getX() === pos2.getX() &&
                pos1.getY() === pos2.getY() &&
                pos1.getZ() === pos2.getZ();
        } catch (e) {
            // Return false if any method call fails
            return false;
        }
    }

    /**
     * Get current latency stats
     */
    public getCurrentLatency() {
        // Ensure completedMeasurements is an array
        if (!Array.isArray(this.completedMeasurements)) {
            this.completedMeasurements = [];
        }
        
        // Safe calculations to avoid errors
        const hasCompletedMeasurements = this.completedMeasurements.length > 0;
        const minLatency = hasCompletedMeasurements ? 
            Math.min(...this.completedMeasurements) : 0;
        const maxLatency = hasCompletedMeasurements ? 
            Math.max(...this.completedMeasurements) : 0;
        
        // Count pending measurements safely
        let pendingCount = 0;
        if (Array.isArray(this.pendingMeasurements)) {
            pendingCount = this.pendingMeasurements.filter(
                m => m && !m.matched && !m.timeout
            ).length;
        }
        
        return {
            current: this.currentEMA,
            raw: hasCompletedMeasurements ? 
                this.completedMeasurements[this.completedMeasurements.length - 1] : null,
            samples: this.completedMeasurements.length,
            min: minLatency,
            max: maxLatency,
            pending: pendingCount,
            timeout: this.currentTimeout
        };
    }

    /**
     * Display latency in chat
     */
    public displayLatency(): void {
        const stats = this.getCurrentLatency();
        if (stats.samples > 0) {
            Client.displayChatMessage(`§8[§bLatency§8] §fCurrent: §b${Math.round(stats.current)}ms §f(Min: §a${stats.min}ms§f, Max: §c${stats.max}ms§f) | Samples: §b${stats.samples}`);
        } else {
            Client.displayChatMessage(`§8[§bLatency§8] §cNo measurements yet`);
        }
    }

    /**
     * Reset all measurements
     */
    public reset(): void {
        this.pendingMeasurements = [];
        this.completedMeasurements = [];
        this.currentEMA = 0;
        this.currentTimeout = this.DEFAULT_TIMEOUT;
        Client.displayChatMessage(`§8[§bLatency§8] §fMeasurements reset`);
    }
}

const script = registerScript.apply({
    name: "latency-measurement",
    version: "1.0.0",
    authors: ["commandblock2"]
});

const latencyMonitor = new LatencyMonitor();

script.registerModule({
    name: "latency-measurement",
    description: "Measures actual server latency by monitoring existing packet exchanges",
    category: "Client",
    settings: {
        displayHud: Setting.boolean({
            name: "DisplayHUD",
            default: true,
            // description: "Show latency on HUD"
        }),
        autoDisplay: Setting.boolean({
            name: "AutoDisplay",
            default: true,
            // description: "Periodically display latency in chat"
        }),
        emaWeight: Setting.float({
            name: "EMA Weight",
            default: 0.2,
            range: [0.05, 0.5],
            // description: "Weight for new latency measurements (lower = smoother)"
        }),
        measurementMethod: Setting.choose({
            name: "Measurement Method",
            default: "All",
            choices: ["BlockInteraction", "PlayerMove", "HandSwing", "All"],
            // description: "Which packet types to use for measurement"
        })
    }
}, (mod) => {

    // Update EMA weight if changed
    mod.on("valuechanged", (event) => {
        if (event.value.name === "EMA Weight") {
            latencyMonitor["EMA_ALPHA"] = mod.settings.emaWeight.getValue();
        }
    });

    mod.on("packet", (event: PacketEvent) => {
        try {
            if (!event.original) {
                return; // Ignore non-original packets
            }

            const packet = event.packet;
            const method = mod.settings.measurementMethod.getValue();

            // Track outgoing packets
            if (event.origin === TransferOrigin.OUTGOING) {
                // Block interaction method
                if ((method === "BlockInteraction" || method === "All") &&
                    packet instanceof PlayerInteractBlockC2SPacket) {
                    const blockPos = packet.getBlockHitResult().getBlockPos();
                    if (blockPos) {
                        latencyMonitor.trackOutgoingInteraction(blockPos);
                    }
                }
            }

            // Match incoming packets
            if (event.origin === TransferOrigin.INCOMING) {
                // Block update method
                if ((method === "BlockInteraction" || method === "All") &&
                    packet instanceof BlockUpdateS2CPacket) {
                    const blockPos = packet.getPos();
                    if (blockPos) {
                        latencyMonitor.matchIncomingBlockUpdate(blockPos);
                    }
                }
            }
        } catch (e) {
            // Silently catch errors to prevent script from breaking
            console.error("Error in packet handler:", e);
        }
    });

    // Render latency on HUD if enabled
    mod.on("overlayrender", () => {
        if (mod.settings.displayHud.getValue()) {
            const stats = latencyMonitor.getCurrentLatency();
            if (stats.samples > 0) {
                // HUD Rendering would go here
                // Client.drawStringWithShadow() is commented out as it's not available
            }
        }
    });
});

// Register commands at script level
script.registerCommand({
    name: "latencyreset",
    onExecute: () => {
        try {
            latencyMonitor.reset();
        } catch (e) {
            Client.displayChatMessage("§8[§bLatency§8] §cError in reset command");
        }
    }
});

script.registerCommand({
    name: "latency",
    onExecute: () => {
        try {
            latencyMonitor.displayLatency();
        } catch (e) {
            Client.displayChatMessage("§8[§bLatency§8] §cError in latency command");
        }
    }
});
