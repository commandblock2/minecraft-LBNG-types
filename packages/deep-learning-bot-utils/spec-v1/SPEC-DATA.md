### Bot Training Data Specification (Information Types)

**Objective:** Define the data types required for iterative training of a Minecraft bot, prioritizing pathfinding and traversability, then expanding to inventory and game context.

**Core Principles:**

1.  **State-Action Pairing:** Data is structured as `(State, Action)` pairs.
2.  **Modularity:** State components can be included or excluded based on training phase.
3.  **Actionability:** Inventory and game item data must be represented to enable specific in-game actions.
4.  **Contextual Relevance:** Data collected should accurately reflect the environment relevant to the bot's current skill focus.
5.  **Temporal Awareness:** Incorporate historical context for improved decision-making and learning from past experience.

---

#### **Phase 1: Core Pathfinding & Traversability (Information Types)**

**Player State:**

*   **Position:** Absolute 3D world coordinates (`X`, `Y`, `Z`).
*   **Velocity:** 3D velocity vector (`VX`, `VY`, `VZ`).
*   **Look Direction:** Spherical coordinates (`Yaw`, `Pitch`).
*   **Player Pose:** Categorical state (e.g., `STANDING`, `SNEAKING`, `SPRINTING`).
*   **Ground Proximity:** Boolean indicating if the player is on the ground.
*   **Predicted Passive Next Tick State:** The player's simulated position and velocity at the next tick, assuming no active input from the bot, but accounting for current game physics (gravity, potion effects, block friction).
    *   `Predicted_Pos_X`, `Predicted_Pos_Y`, `Predicted_Pos_Z`
    *   `Predicted_Vel_X`, `Predicted_Vel_Y`, `Predicted_Vel_Z`
*   **Historical Player States:** A fixed-size list (e.g., last 3-5 ticks) of:
    *   **Previous Position:** (`X`, `Y`, `Z`) at past tick.
    *   **Previous Velocity:** (`VX`, `VY`, `VZ`) at past tick.
    *   **Previous Look Direction:** (`Yaw`, `Pitch`) at past tick.
    *   **Previous Player Pose:** Categorical state at past tick.
    *   **Previous Fall Distance:**.

**Local Environment Scan (Collision Box List):**

*   A collection of collision boxes from nearby environmental elements within a defined spatial radius, plus dynamic areas of interest. Each collision box contains:
    *   **Bounding Box Coordinates:** The precise geometric bounds (`minX`, `minY`, `minZ`, `maxX`, `maxY`, `maxZ`) of the collision box, normalized relative to the player position.
    *   **Relative Position:** Center point of the collision box relative to the player (`centerX`, `centerY`, `centerZ`).
    *   **Box Dimensions:** Width, height, and depth of the collision box (`width`, `height`, `depth`).
    *   **Element Identifier:** A unique string label for the element type that owns this collision box (e.g., `minecraft:stone`, `minecraft:water`, `minecraft:boat`).
    *   **Traversability Data:** A categorization indicating how the player can interact with this collision box:
        *   `SOLID_WALKABLE`
        *   `FLUID`
        *   `OBSTRUCTION`
        *   `AIR`
        *   `LIQUID_PLACEABLE`
        *   `PLACEABLE_BLOCK`
        *   `OTHER`
    *   **Element State Properties:** Specific configuration data for the element (e.g., directionality of stairs, state of a farmland block, door open/closed).
    *   **Area Source Type:** Categorical indicator of how this collision box was included in the scan:
        *   `FIXED_RADIUS` - Collision box within fixed scanning radius around player
        *   `DYNAMIC_INTEREST` - Collision box included due to area of interest output
    *   **Box Validity:** Boolean indicating if this collision box slot contains valid data (used for padding in fixed-size arrays).

**Simplified Inventory Snapshot:**

*   **Hotbar Slots:** A fixed-size array (e.g., 9 elements) representing the player's hotbar. For each slot:
    *   **Item Identifier:** String label for the item (e.g., `minecraft:water_bucket`, `null` for empty).
    *   **Item Quantity:** The count of that item in the slot.
*   **Key Utility Indicators:** Boolean flags for critical items relevant to traversal:
    *   `hasWaterBucket`
    *   `hasPlaceableBlocks`

**Baritone Reference Data (Training Phase Only):**

Note: this is subject to change, we will ignore this completely for now.

*   **Current Target Path:** A sequence of waypoints representing Baritone's computed optimal path to the current goal.
    *   **Path Waypoints:** Array of 3D coordinates (`X`, `Y`, `Z`) representing the sequence of blocks to traverse.
    *   **Path Length:** Total number of waypoints in the current path.
    *   **Next Waypoint Index:** Index of the next waypoint the bot should move toward.
    *   **Estimated Completion Time:** Baritone's estimate of ticks required to complete the path.
*   **Path Metadata:**
    *   **Path Computation Tick:** The game tick when this path was computed by Baritone.
    *   **Goal Coordinates:** The target destination (`GoalX`, `GoalY`, `GoalZ`) for this path.
    *   **Path Validity:** Boolean indicating if the path is still valid (no environmental changes detected).

---

#### **Phase 2: PvP & Game Objective Awareness (Information Types)**

**Player State (Additions):**

*   **Equipment:** Identifiers and states of items held in main and off-hand.

**Targeting Information:**

*   A collection of nearby entities within a defined radius. For each entity relevant to objectives or combat:
    *   **Entity Identifier:** Unique ID.
    *   **Entity Type:** Categorical label (e.g., `PLAYER`, `ITEM`, `MOB`).
    *   **Entity Position:** Relative 3D coordinates.
    *   **Entity State:** Key attributes like health, distance.
    *   **Combat Relevance:** A flag indicating if the entity is considered an "enemy" or target for the current game mode.

---

**Action Types:**

*   **Movement:** `MOVE` (with directional components), `JUMP`, `SNEAK`, `SPRINT`.
*   **Interaction:** `LOOK` (with direction changes), `USE_ITEM` (specifying item/slot and target), `PLACE_BLOCK` (specifying item/slot, target position, and face).
*   **Combat:** `ATTACK_ENTITY` (specifying target entity and arm swing), `SWAP_OFFHAND` (to switch items between hands).
*   **Path of Interest Generation:** `GENERATE_AREA_OF_INTEREST` (specifying a sequence of 3D coordinates that define additional areas for detailed environmental scanning beyond the fixed radius).

---

#### **Phase 3: Network Manipulation & Latency Awareness (Information Types)**

*   **Network State:**
    *   **Current Client Latency:** Numerical value representing the round-trip time (ping) to the server in milliseconds.
    *   **Server Tick Delta:** Numerical value indicating the difference between client and server tick counts, useful for gauging desync.
    *   **Outgoing Packet Queue Size:** Numerical count of packets currently queued for transmission from the client.
    *   **Incoming Packet Queue Size:** Numerical count of packets currently buffered for processing on the client.

---


#### **Phase 4: Inventory Management & Contextual Actions (Information Types)**

**Detailed Inventory Snapshot:**

*   **Hotbar Slots:** (As in Phase 1)
*   **Main Inventory Counts:** A mapping of `Item Identifier` to `Quantity` for key stackable items NOT on the hotbar.
*   **Selected Hotbar Slot:** The index of the currently active hotbar slot.

