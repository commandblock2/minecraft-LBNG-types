
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

2.  **Local Environment Scan (3D Voxel Grid Tensor):**
    *   **Shape:** `(GridSizeX, GridSizeY, GridSizeZ, Channels)` (e.g., 16x16x16 voxels, 10-20 channels).
    *   **Channels per Voxel (Concatenated Features):**
        *   `Element Identifier`: One-hot encoding of block type (potentially learned embeddings for large vocabularies).
        *   `Traversability Data`: One-hot encoding (e.g., `SOLID_WALKABLE`, `FLUID`).
        *   `IsOccupiedByBoundingBox`: Binary flag.
        *   `Element State Properties`: One-hot or numerical features for block states (e.g., `IsDoorOpen`).

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

5.  **Special Interest Output Branch (Probabilities):**
    *   `Areas of Interest for Detailed Scan`: A `(SmallGridX, SmallGridY, SmallGridZ)` tensor, where each value indicates a probability or score of that block being "interesting". This output would typically be used by an external module to trigger more detailed data collection or camera movement, rather than directly controlling in-game actions. It helps in training the bot to intelligently explore and identify relevant features in the environment.

6.  **Network Control Branch (Probabilities & Conditional Parameters):**
    *   This branch controls actions related to manipulating network packets. Note that implementing these actions requires an external mechanism (e.g., a proxy or custom network stack) that the bot's decisions interface with.
    *   `Manage Network Flow`: `[Probability_0_1]` (sigmoid, to indicate if the bot wants to actively manage or manipulate network flow for the current tick).
        *   *If `Manage Network Flow` is active:*
        *   `Desired Incoming Packet Policy`: `[OneHot(NORMAL), OneHot(SHORT_DELAY), OneHot(MEDIUM_DELAY), OneHot(LONG_DELAY), OneHot(HOLD_ALL_INCOMING)]` (softmax over predefined delay profiles, plus `HOLD_ALL_INCOMING`).
        *   `Desired Outgoing Packet Policy`: `[OneHot(NORMAL), OneHot(SHORT_DELAY), OneHot(MEDIUM_DELAY), OneHot(LONG_DELAY), OneHot(HOLD_ALL_OUTGOING)]` (softmax over predefined delay profiles, plus `HOLD_ALL_OUTGOING`).



This detailed specification ensures that the bot's neural network has the necessary information to make complex, concurrent decisions, and the framework supports iterative learning through its recurrent memory and the ability to train for specific behaviors.