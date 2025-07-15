
### Neural Network Input and Output Definitions

The neural network will be designed to process current observations and an internal recurrent state to produce concurrent actions and specific outputs like "areas of interest."

#### Neural Network Inputs (Observation Space)

The input to the neural network for each game tick will consist of the current environmental and player state, which will then be combined with the network's recurrent hidden state to form the *effective* input for the final decision-making layers.

1.  **Current Player State (Numerical Vector + Categorical/Embeddings):**
    *   **Numerical:**
        *   `Position`: `[X, Y, Z]` (normalized, possibly relative to goal or spawn)
        *   `Velocity`: `[VX, VY, VZ]` (normalized)
        *   `Look Direction`: `[sin(Yaw), cos(Yaw), sin(Pitch), cos(Pitch)]`
        *   `Fall Distance`: `[FallDistance_Normalized]`
        *   `Predicted Passive Next Tick Position`: `[Predicted_X, Predicted_Y, Predicted_Z]` (normalized)
        *   `Predicted Passive Next Tick Velocity`: `[Predicted_VX, Predicted_VY, Predicted_VZ]` (normalized)
    *   **Categorical/Binary (One-Hot or Embeddings):**
        *   `Player Pose`: e.g., `[OneHot(STANDING), OneHot(SNEAKING), ...]`
        *   `Ground Proximity`: `[0]` or `[1]`
        *   `Key Utility Indicators`: `[hasWaterBucket_Binary, hasPlaceableBlocks_Binary]`
        *   **Goal Encoding:**
            *   `Target Coordinates`: `[GoalX, GoalY, GoalZ]` (normalized)
            *   `Target Entity Info`: `[TargetEntity_Type_OneHot, TargetEntity_Health_Normalized, TargetEntity_Distance_Normalized]` (if the goal is an enemy entity)

2.  **Local Environment Scan (Collision Box List):**
    *   **Shape:** `(MAX_COLLISION_BOXES, BOX_FEATURE_SIZE)` (e.g., up to 512 boxes, 16-20 features per box).
    *   **Composition:** Combined list of collision boxes from fixed radius scan + dynamic area of interest
    *   **Per-Box Features (Concatenated Vector):**
        *   `Bounding Box Coordinates`: `[minX, minY, minZ, maxX, maxY, maxZ]` (normalized relative to player)
        *   `Relative Position`: `[relativeX, relativeY, relativeZ]` (box center relative to player)
        *   `Box Dimensions`: `[width, height, depth]` (derived from min/max coordinates)
        *   `Element Identifier`: Learned embedding of block/entity type
        *   `Traversability Data`: One-hot encoding (e.g., `SOLID_WALKABLE`, `FLUID`, `OBSTRUCTION`)
        *   `Element State Properties`: Numerical features for block states (e.g., `IsDoorOpen`, `StairDirection`)
        *   `Area Source Type`: One-hot encoding (`FIXED_RADIUS`, `DYNAMIC_INTEREST`)
        *   `Box Validity Mask`: Binary flag indicating if this slot contains a valid collision box (for padding)
    *   **Neural Network Processing Notes:**
        *   Use attention mechanisms or set-based networks (e.g., Deep Sets, Set Transformer) to handle variable-length collision box lists
        *   The `Box Validity Mask` enables proper masking for padded entries in fixed-size tensors
        *   Consider spatial attention based on `Relative Position` to focus on nearby collision boxes
        *   Learned embeddings for `Element Identifier` can capture semantic relationships between block types

3.  **Inventory Snapshot (Numerical Vector + Categorical/Embeddings):**
    *   **Hotbar Slots (Fixed-Size List of Vectors):** For each of 9 slots:
        *   `[ItemIdentifier_OneHot/Embedding, ItemQuantity_Normalized]`
    *   `Selected Hotbar Slot`: `[OneHot(Index_of_Active_Slot)]`
    *   **Main Inventory Counts (Fixed-Size List for N Pre-Defined Items):** For each important
        *   `[ItemIdentifier_OneHot/Embedding, ItemQuantity_Normalized]`

4.  **Targeting Information (Concatenated Vectors for Fixed N Entities):**
    *   For `N` closest/most relevant entities:
        *   `[EntityType_OneHot/Embedding, RelativePosition_dX,dY,dZ, EntityHealth_Normalized, EntityDistance_Normalized, CombatRelevance_Binary]`
        *   (Padding with zeros or "null" entity embeddings if fewer than `N` entities are present).

5.  **Game State (Numerical/Binary Vector):**
    *   `Team Status`: `[IsBedBroken_Binary]`
    *   `Objective Locations`: `[Objective1_X, Objective1_Y, Objective1_Z, ...]`

6.  **Recurrent Hidden State (Managed by Inference Loop):**
    *   This is the compressed "memory" of the sequence processed so far. It's the output of the previous timestep's recurrent layer and is fed back as an input to the current timestep's recurrent layer. This is not part of the raw `Observation Space` from the game but is an essential component of the network's input processing.
    *   **Size:** Fixed, e.g., `(num_layers, batch_size, hidden_size)` for GRU/RNN or tuple for LSTM.

7.  **Network State (Numerical and Categorical):**
    *   `Current Client Latency`: `[Latency_ms_Normalized]`
    *   `Server Tick Delta`: `[Server_Tick_Delta_Normalized]`
    *   `Outgoing Packet Queue Size`: `[Outgoing_Queue_Normalized]`
    *   `Incoming Packet Queue Size`: `[Incoming_Queue_Normalized]`
    *   `Current Incoming Policy Applied`: `[OneHot(NORMAL), OneHot(SHORT_DELAY), OneHot(MEDIUM_DELAY), OneHot(LONG_DELAY), OneHot(HOLD_ALL_INCOMING)]` (reflecting the currently active incoming manipulation strategy)
    *   `Current Outgoing Policy Applied`: `[OneHot(NORMAL), OneHot(SHORT_DELAY), OneHot(MEDIUM_DELAY), OneHot(LONG_DELAY), OneHot(HOLD_ALL_OUTGOING)]` (reflecting the currently active outgoing manipulation strategy)


#### Neural Network Outputs (Action Space - Concurrent)

The neural network will generate multiple outputs in parallel, representing the bot's intended actions for the current tick. Probabilities (via sigmoid for binary, softmax for categorical) or direct regression values for continuous actions.

1.  **Movement & Pose Action Branch (Probabilities & Regression):**
    *   `Move Forward/Backward`: `[Float]` (e.g., regression between -1.0 and 1.0)
    *   `Strafe Left/Right`: `[Float]` (e.g., regression between -1.0 and 1.0)
    *   `Jump`: `[Probability_0_1]` (sigmoid)
    *   `Sneak`: `[Probability_0_1]` (sigmoid)
    *   `Sprint`: `[Probability_0_1]` (sigmoid)

2.  **Look Direction Branch (Regression):**
    *   `Delta Yaw`: `[Float]` (relative turn amount, e.g., in radians or degrees)
    *   `Delta Pitch`: `[Float]` (relative look up/down amount)

3.  **Interaction Action Branch (Probabilities & Conditional Parameters):**
    *   `Use Item (Primary/Right Click)`: `[Probability_0_1]` (sigmoid)
        *   *If actively using:*
        *   `Selected Hotbar Slot for Use`: `[OneHot_0_8]` (softmax over 9 slots)
        *   `Target Position for Use`: `[TargetX, TargetY, TargetZ]` (regression, relative to player)
    *   `Place Block (Secondary/Place Action)`: `[Probability_0_1]` (sigmoid)
        *   *If actively placing:*
        *   `Selected Hotbar Slot for Place`: `[OneHot_0_8]` (softmax)
        *   `Target Relative Position for Place (3D Grid)`: A `(SmallGridX, SmallGridY, SmallGridZ)` tensor, where values indicate probability of placing at each relative block coordinate (e.g., sigmoid for each voxel).
        *   `Target Face for Place`: `[OneHot_0_5]` (softmax over UP, DOWN, NORTH, EAST, SOUTH, WEST)
    *   `Swap Offhand`: `[Probability_0_1]` (sigmoid)

4.  **Combat Action Branch (Probabilities & Conditional Parameters):**
    *   `Attack Entity (Primary/Left Click)`: `[Probability_0_1]` (sigmoid)
        *   *If actively attacking:*
        *   `Target Entity Index for Attack`: `[OneHot_0_N]` (softmax over the N targeted entities from input)

5.  **Special Interest Output Branch (Path of Interest Generation):**
    *   `Areas of Interest for Detailed Scan`: A `(SmallGridX, SmallGridY, SmallGridZ)` tensor, where each value indicates a probability or score of that block being "interesting". This output determines which additional collision boxes (beyond the fixed radius) will be fed into the neural network on the next tick.
    *   `Path Waypoints`: A sequence of 3D coordinates `[(X1,Y1,Z1), (X2,Y2,Z2), ...]` representing the bot's predicted optimal path. During training, this is compared against Baritone's pathfinding output as ground truth.
    *   `Path Confidence`: A scalar value indicating the bot's confidence in its generated path, used for training stability and exploration strategies.

6.  **Network Control Branch (Probabilities & Conditional Parameters):**
    *   This branch controls actions related to manipulating network packets. Note that implementing these actions requires an external mechanism (e.g., a proxy or custom network stack) that the bot's decisions interface with.
    *   `Manage Network Flow`: `[Probability_0_1]` (sigmoid, to indicate if the bot wants to actively manage or manipulate network flow for the current tick).
        *   *If `Manage Network Flow` is active:*
        *   `Desired Incoming Packet Policy`: `[OneHot(NORMAL), OneHot(SHORT_DELAY), OneHot(MEDIUM_DELAY), OneHot(LONG_DELAY), OneHot(HOLD_ALL_INCOMING)]` (softmax over predefined delay profiles, plus `HOLD_ALL_INCOMING`).
        *   `Desired Outgoing Packet Policy`: `[OneHot(NORMAL), OneHot(SHORT_DELAY), OneHot(MEDIUM_DELAY), OneHot(LONG_DELAY), OneHot(HOLD_ALL_OUTGOING)]` (softmax over predefined delay profiles, plus `HOLD_ALL_OUTGOING`).



This detailed specification ensures that the bot's neural network has the necessary information to make complex, concurrent decisions, and the framework supports iterative learning through its recurrent memory and the ability to train for specific behaviors.