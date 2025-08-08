### 1. Input Data Schema (Observation Space)

The bot will receive observations structured similarly to `SPEC-DATA`'s Phase 1, with specific exclusions and a crucial reinterpretation for `DYNAMIC_INTEREST`.

**Input Data (Observation Dictionary/Structure):**

*   **Player State:** (As per previous revision, aligned with `SPEC-DATA` Phase 1)
    *   **Position:** Absolute 3D world coordinates (`X`, `Y`, `Z`).
    *   **Velocity:** 3D velocity vector (`VX`, `VY`, `VZ`).
    *   **Look Direction:** Spherical coordinates (`Yaw`, `Pitch`).
    *   **Player Pose:** Categorical state (`STANDING`, `SNEAKING`, `SPRINTING`).
    *   **Ground Proximity:** Boolean.
    *   **Predicted Passive Next Tick State:** (`Predicted_Pos`, `Predicted_Vel`).
    *   **Historical Player States:** Last `N` ticks (e.g., 40 ticks) of previous `Position`, `Velocity`, `Look Direction`, `Player Pose`, `Fall Distance`.

*   **Local Environment Scan (Collision Box List):** (As per previous revision, aligned with `SPEC-DATA` Phase 1)
    *   A collection of collision boxes from nearby environmental elements.
    *   Each box includes:
        *   `Bounding Box Coordinates` (relative to player).
        *   `Relative Position` (center point relative to player).
        *   `Box Dimensions`.
        *   `Element Identifier` (e.g., `minecraft:stone`).
        *   `Traversability Data` (e.g., `SOLID_WALKABLE`, `FLUID`, `OBSTRUCTION`, `AIR`, `LIQUID_PLACEABLE`, `PLACEABLE_BLOCK`, `OTHER`).
        *   `Element State Properties` (e.g., `directionality of stairs`).
        *   **CRITICAL RE-INTERPRETATION:** `Area Source Type`:
            *   `FIXED_RADIUS` - Collision box within fixed scanning radius around player. (however could done sophisticatedly by using a bfs like algorithm, to only "raytrace" the surface visible blocks)
            *   `DYNAMIC_INTEREST` - **Collision box included because it is within a small radius of *any* block on Baritone's current *planned path*. This effectively highlights the path and its immediate surroundings for the agent.**
        *   `Box Validity`.
    *   **Note:** The agent will interpret `Traversability Data` as properties of the environment.

**Exclusions for MVP:**
*   `Simplified Inventory Snapshot`.
*   `Baritone Reference Data` (no direct `Path Waypoints`, `Path Length`, etc. as input to the RL agent).

---

### 2. Baritone Integration & "Baritone-Influenced AOI"

*   **Baritone Role:** Baritone runs in the background, continuously computing an optimal path to a designated goal. It acts as the high-level planner and the source of truth for "where to go."
*   **AOI Definition by Baritone (for Agent):**
    *   Baritone's planned path (a sequence of block coordinates) is used to populate the `DYNAMIC_INTEREST` flags within the `Local Environment Scan`. All collision blocks surrounding these path blocks within a small radius (e.g., 1-2 blocks) will have `Area Source Type = DYNAMIC_INTEREST`. This helps the agent prioritize environmental features along the intended path.

---

### 3. Network Structure (Reinforcement Learning Agent)

(No changes from previous revision, as the conceptual input difference is in *how* `DYNAMIC_INTEREST` is derived, not in the core data types themselves.)

*   **Type:** Policy-Value Network (Actor-Critic).
*   **Input Layer:** A flat vector or structured input reflecting the `Input Data Schema`.
    *   **Player State:** Concatenate numerical values directly.
    *   **Local Environment Scan:** Each collision box's data (bounding box, element ID, traversability data, `DYNAMIC_INTEREST` flag etc.) needs to be one-hot encoded or numerically represented and concatenated. This might involve a fixed-size array of collision boxes, padding if fewer are present.
    *   _Example:_ For `N` collision boxes, each represented by a vector `[minX, minY, ..., width, height, ..., one_hot_traversability, one_hot_element_id, one_hot_area_source_type, ...]`.
*   **Temporal Processing Layer (NEW):**
    *   Given the high observation frequency (every game tick) and the need to perceive transient states over a window (e.g., 40 ticks), `Long Short-Term Memory (LSTM)` units or `Gated Recurrent Units (GRU)` are highly recommended.
    *   These layers can process sequential input, allowing the network to learn dependencies and patterns over time.
    *   Alternatively, for potentially better parallelization and long-range dependencies, a `Transformer Encoder` block could be used, particularly for processing the sequence of "Local Environment Scans."
*   **Hidden Layers:**
    *   Following the temporal processing layer, multiple Dense layers (e.g., 3-4 layers with 128-256 units) can further process the learned temporal features.
    *   ReLU activation.
*   **Output Layers:**
    *   **Policy Head (Actor):**
        *   Dense layer with Softmax for action probabilities.
        *   **Action Space (Simplified):** Focus on core movement.
            *   `MOVE` (discretized directions: `FORWARD`, `BACKWARD`, `LEFT`, `RIGHT`, `FORWARD_LEFT`, etc., or continuous 2D `(dx, dy)`).
            *   `LOOK` (discretized `(pitch_change, yaw_change)` or continuous).
            *   `JUMP`.
            *   `SNEAK` (toggle).
            *   `SPRINT` (toggle).
            *   **Crucially:** Exclusions from `SPEC-DATA` Action Types: `USE_ITEM`, `PLACE_BLOCK`, `ATTACK_ENTITY`, `SWAP_OFFHAND`, `GENERATE_AREA_OF_INTEREST`.
    *   **Value Head (Critic):**
        *   Dense layer (1 unit) with Linear activation to predict state value.

**Architectural Changes/Considerations for 40-Tick Perception:**

*   **Input to Temporal Layer:** Instead of just the current observation, the temporal processing layer would receive a sequence of `(current_tick_observation, previous_tick_observation, ..., observation_at_t-39)`.
*   **LSTM/GRU Implementation:**
    *   The `Player State` and `Local Environment Scan` for each tick would be combined into a single feature vector for that tick.
    *   A sequence of these feature vectors (40 in this case) would be fed into an LSTM or GRU layer.
    *   The output of the LSTM/GRU (typically the hidden state of the last time step, or an attention-weighted sum of hidden states) would then be passed to the subsequent dense layers.
*   **Transformer Implementation:**
    *   Each tick's combined feature vector (or even separate embeddings for player state and environment scan) would be treated as a token in a sequence.
    *   Positional encodings would be added to these tokens to retain temporal information.
    *   Multiple Transformer Encoder blocks would process this sequence.
    *   A pooling layer (e.g., mean pooling, or a dedicated `<CLS>` token similar to BERT) could aggregate the sequence output into a fixed-size vector for the dense layers.
*   **Historical Player States in Input:** If you introduce RNNs/Transformers, the explicit "Historical Player States: Last N ticks" might become redundant or could be simplified, as the recurrent layer is designed to maintain its own internal "memory" of past states. You'd primarily feed the current tick's full observation into the sequence.
*   **Training Challenges:** Recurrent networks can be harder to train (vanishing/exploding gradients, longer training times). Strategies like truncated Backpropagation Through Time (BPTT), gradient clipping, and careful initialization become more critical.

---

### 4. Training Process: Two-Stage Approach

This MVP implements a two-stage training regimen for robustness and efficient learning.

#### **Stage 1: Imitation Learning (IL) for Path Execution**

*   **Objective:** Train the agent to mimic the basic locomotion and path following demonstrated by Baritone. This provides a strong behavioral prior.
*   **Data Collection:**
    *   Run Minecraft with Baritone enabled.
    *   Script Baritone to navigate a wide variety of "simple parkour" scenarios (flat ground walking, single-block jumps, stair climbing, short falls, corner turns, simple obstacle avoidance where Baritone paths around).
    *   At each game tick, record
assistant
:
        *   The full `Input Data Schema` (observation) as seen by the bot.
        *   The *action Baritone outputs* to achieve its movement for that tick (e.g., `move_forward`, `jump`). This requires introspection into Baritone's movement commands.
    *   Collect a diverse dataset of `(Observation, Baritone_Action)` pairs.
*   **Training Method:** Supervised Learning.
    *   The agent's Policy Head is trained directly to predict Baritone's action given an observation.
    *   Loss function: Cross-entropy between predicted action probabilities and Baritone's action.
    *   This stage can use a simple feed-forward network to initialize the main RL agent's weights or serve as a pre-training step.

#### **Stage 2: Reinforcement Learning (RL) for Refinement and Robustness**

*   **Objective:** Refine the agent's policy to handle environmental uncertainties, optimize paths (even subtle ones not explicitly planned by Baritone at the micro-level), and recover from minor deviations.
*   **Algorithm:** Proximal Policy Optimization (PPO) or Advantage Actor-Critic (A2C).
*   **Initialization:** The agent's neural network weights are initialized with those learned from Stage 1 (Imitation Learning).
*   **Environment:** Minecraft with client-side API, more specifically through LiquidBounce script api with typescript support. Baritone runs concurrently to provide its path, influencing the `DYNAMIC_INTEREST` flags in the observations.
*   **Reward Function:**
    *   **Goal Progress:** Reward for reducing Euclidean distance to the *current nearest block on Baritone's planned path*. Larger reward for reaching the ultimate target destination (Baritone's goal).
    *   **Path Adherence:** Small positive reward for being within a certain radius of Baritone's current path segment, and for maintaining a "forward" orientation along the path.
    *   **Efficiency:** Small negative reward per timestep.
    *   **Penalties:** Significant negative reward for:
        *   Falling into hazardous blocks (lava, deep water without path).
        *   Taking significant damage.
        *   Getting "stuck" (no progress towards Baritone path for X ticks).
        *   Moving significantly *off* Baritone's path (based on a threshold distance from the path).
*   **Training Episodes:**
    *   Focus on generating training data from specific, procedurally generated parkour challenges, potentially slightly more complex than in Stage 1, that highlight different `Traversability Data` types.
    *   Manage episode length.
*   **Observation Frequency:** every 1 game tick.

### 5. Scenarios (Reduced Complexity)

Testing should focus on fundamental parkour movements that Baritone can inherently plan.

*   **Scenario 1: Simple Walk:** Flat ground, agent needs to reach a target block. (Verifies basic movement, Baritone integration).
*   **Scenario 2: Single Block Jump:** Agent needs to jump over a 1-block gap. (Verifies "jump" action, correct timing based on target waypoint).
*   **Scenario 3: Up a Staircase/Slab Stack:** Agent navigates a small vertical ascent. (Verifies vertical movement, Baritone providing correct segment).
*   **Scenario 4: Around a Corner:** Agent needs to turn. (Verifies turning/directional control).
*   **Scenario 5: Simple Obstacle Avoidance (Baritone-driven):** A single 1-block high wall that Baritone would path around. The RL agent just needs to follow Baritone's "around" path.
*   **Scenario 6: Fall:** Agent needs to fall safely from a ledge. (Verifies handling of negative Y movement).

**Extended for MVP:**
*   Complex parkour (e.g., neo/quad jumps, precise momentum jumps).
*   Complex obstacle avoidance.


### 5. Evaluation Metrics

(No changes from previous revision.)
*   Success Rate: Percentage of episodes where the agent reaches the Baritone final destination.
*   Path Following Error: Average deviation from Baritone's planned path.
*   Efficiency: Steps/time taken to complete tasks.
*   Robustness: Performance across different Baritone-solvable challenging parkour scenarios. This could include scenarios with minor environmental perturbations (e.g., a single block moved) that Baritone would re-path around, and the agent should adapt.