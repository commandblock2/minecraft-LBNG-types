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
        *   **CRITICAL RE-INTERPRETATION:** `Area Source Type`:
            *   `FIXED_RADIUS` - Collision box within fixed scanning radius around player. (however could done sophisticatedly by using a bfs like algorithm, to only "raytrace" the surface visible blocks)
            *   `DYNAMIC_INTEREST` - **Collision box included because it is within a small radius of *any* block on Baritone's current *planned path*. This effectively highlights the path and its immediate surroundings for the agent.**

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

This MVP implements a two-stage training regimen for robustness and efficient learning, leveraging procedurally generated scenarios for scalability.

#### **Stage 1: Imitation Learning (IL) for Path Execution**

*   **Objective:** Train the agent to mimic the basic locomotion and path following demonstrated by Baritone. This provides a strong behavioral prior, teaching the agent how to interpret observations and produce appropriate motor commands.
*   **Data Collection:**
    *   Utilize a **scenario generation module** (e.g., within LiquidBounce or an external tool) to continuously create diverse, procedurally generated parkour challenges. These challenges should be guaranteed to be solvable by Baritone.
    *   Examples include: varying lengths of flat ground, single/multi-block jumps, stair climbing, short falls, various turns, and simple obstacle avoidance (where Baritone paths around).
    *   Run multiple Minecraft instances in parallel, each continuously generating and navigating new scenarios.
    *   At each game tick, record:
        *   The full `Input Data Schema` (observation) as seen by the bot.
        *   The *action Baritone outputs* to achieve its movement for that tick (e.g., `move_forward`, `jump`). This requires introspection into Baritone's movement commands.
    *   Collect a large, diverse dataset of `(Observation, Baritone_Action)` pairs across many generated scenarios.
*   **Training Method:** Supervised Learning.
    *   The agent's Policy Head is trained directly to predict Baritone's action given an observation.
    *   Loss function: Cross-entropy between predicted action probabilities and Baritone's action.
    *   This stage can use a simple feed-forward network to initialize the main RL agent's weights or serve as a pre-training step.

#### **Stage 2: Reinforcement Learning (RL) for Refinement and Robustness**

*   **Objective:** Refine the agent's policy to handle environmental uncertainties, optimize paths (even subtle ones not explicitly planned by Baritone at the micro-level), recover from minor deviations, and achieve more generalized and efficient navigation.
*   **Algorithm:** Proximal Policy Optimization (PPO) or Advantage Actor-Critic (A2C).
*   **Initialization:** The agent's neural network weights are initialized with those learned from Stage 1 (Imitation Learning).
*   **Environment:** Minecraft with client-side API, specifically through LiquidBounce script API with TypeScript support. Baritone runs concurrently to provide its path, influencing the `DYNAMIC_INTEREST` flags in the observations.
*   **Reward Function:**
    *   **Goal Progress:** Reward for reducing Euclidean distance to the *current nearest block on Baritone's planned path*. Larger reward for reaching the ultimate target destination (Baritone's goal).
    *   **Path Adherence:** Small positive reward for being within a certain radius of Baritone's current path segment, and for maintaining a "forward" orientation along the path.
    *   **Efficiency:** Small negative reward per timestep to encourage faster completion.
    *   **Penalties:** Significant negative reward for:
        *   Falling into hazardous blocks (lava, deep water without path).
        *   Taking significant damage.
        *   Getting "stuck" (no progress towards Baritone path for X ticks).
        *   Moving significantly *off* Baritone's path (based on a threshold distance from the path).
*   **Training Episodes:**
    *   **Procedural Generation:** Continue using the scenario generation module from Stage 1, but now for live RL interaction.
    *   **Curriculum Learning:** Implement a curriculum where scenarios gradually increase in complexity. Start with simpler paths (e.g., flat ground, single jumps) and progressively introduce more challenging elements (e.g., longer jumps, more complex turns, varying verticality, basic weaving challenges). This helps prevent the agent from getting stuck in local optima early in training.
    *   Manage episode length.
*   **Observation Frequency:** every 1 game tick.

---

### 5. Scenario Generation

Training will rely heavily on procedurally generating diverse and solvable navigation challenges for the bot. This allows for scalable data collection and robust policy learning.

**Goals of Scenario Generation:**

*   **High Diversity:** Provide a wide variety of environmental configurations to enhance agent generalization.
*   **Scalability:** Enable continuous, parallel data collection/training across multiple Minecraft instances.
*   **Controlled Complexity:** Introduce challenges incrementally, supporting curriculum learning.
*   **Guaranteed Solvability:** Ensure that Baritone can always find a path to the end target, providing reliable "expert" demonstrations for IL and clear goals for RL.

**Categories of Generated Scenarios:**

*   **Basic Pathing:** Straight lines, simple turns, varying path widths (1-block, 2-block).
*   **Vertical Mobility:** Single block ascents/descents (stairs, slabs), multi-block climbs, small controlled falls.
*   **Gap Navigation:** Single-block jumps, multi-block jumps (requiring sprinting), precise landing challenges.
*   **Controlled Obstacles:** Paths requiring weaving around 1-block obstacles, simple over-under sections.
*   **Combinatorial:** Scenarios that combine multiple elements (e.g., jump onto a narrow path, turn, then climb stairs).

**Generation Mechanisms:**

*   **Rule-Based/Grammar-Based:** Define a set of rules or a simple grammar that dictates how path segments and obstacles are placed. This allows for controlled variation with parameters (e.g., jump distance, turn radius, obstacle density).
*   **Randomized Parameters:** Introduce randomness in various parameters within the rules (e.g., path length, number of turns, height changes) to ensure unpredictability.
*   **Verb-based / Verb-Sequence Generator (NEW):** To make generation expressive and easier to control/curriculum, the generator will produce a short sequence of high-level "verbs" (actions) — a small domain-specific language — and then render the world layout from that sequence. This maps directly to human-describable scenario patterns and is convenient for controlled curriculum and logging.
    *   Vocabulary (example):
        *   WALK(n) — advance n steps on flat ground
        *   TURN(direction) — change heading (LEFT / RIGHT)
        *   GAP(n) — create a gap of n blocks in the forward direction (Baritone-solvable constraint: n ≤ 3 for this MVP)
        *   JUMP_TO(h) — place a single-step up of height h (usually h = 1)
        *   CLIMB(n) — create an ascending run of n steps (stairs)
        *   DESCEND(n) — create a descending run of n steps
        *   OBSTACLE(density) — place small single-block obstacles in the path with given density
        *   NARROW(n) — force path width to n (1 or 2)
    *   Example grammar / short program example:
        *   [WALK(3), GAP(1), WALK(2), TURN(RIGHT), WALK(4), CLIMB(2), GAP(2), WALK(3)]
    *   Generation algorithm:
        1.  Sample a difficulty (curriculum) parameter that bounds choices (max gap, rate of turns, verticality).
        2.  Sample a sequence length L (e.g., 6–20 primitives depending on difficulty).
        3.  Generate a verb sequence using weighted random choices from the vocabulary constrained by difficulty (e.g., at low difficulty, GAP probabilities are small and max gap = 1).
        4.  Render the verb sequence into world coordinates starting from player's current block and facing. The renderer lays out blocks, gaps, stairs, obstacles accordingly.
        5.  After rendering, set the Baritone goal to the final block of the rendered path and verify that Baritone can compute a path. If Baritone fails or computes an invalid path (e.g., due to a too-large gap), the generator should either (a) reduce the offending primitives and re-render, or (b) re-sample the verb sequence until a solvable one is produced. For MVP we prefer (b) with a bounded number of retries.
    *   Implementation notes:
        *   Keep path length concise (under 50 blocks).
        *   Ensure the verb renderer produces collision boxes count under the DataCollector performance budget (e.g., < 200).
        *   Enforce Baritone solvability constraint: maximum GAP ≤ 3 (Baritone can at most jump a 3-block gap in this environment).
        *   Expose the generated verb program alongside the world layout in the scenario metadata so training logs can replay or analyze the high-level structure of scenarios.
*   **In-Game Module:** A dedicated LiquidBounce script module will be responsible for:
    1.  Clearing the active play area around the player (keep the block under the player).
    2.  Translating a generated verb-sequence program into a concrete world layout and placing the necessary blocks/gaps/obstacles.
    3.  Setting Baritone's goal to the end of the newly generated path (DataCollector and other modules should be configured to point to the same goal).
    4.  Monitoring Baritone's success/failure for the current scenario and marking the episode accordingly.
    5.  Triggering a new generation cycle upon completion or failure (with optional difficulty adjustment for curriculum).
    *   **Constraint:** Ensure generated paths are concise (e.g., under 50 blocks) and keep the total number of relevant collision boxes low (e.g., under 200) to respect data collector's performance limitations.

**Curriculum Learning Integration:**

*   The verb-sequence generator exposes a difficulty parameter that constrains sampling distributions:
    *   Low difficulty: mostly WALK, occasional 1-block GAP, few turns, limited vertical changes.
    *   Medium difficulty: more frequent turns, GAP up to 2, small climbs/descents, occasional obstacles.
    *   High difficulty: GAP up to 3, more verticality and turns, denser obstacles and narrow segments.
*   Difficulty can be adapted online using agent performance statistics (success rate, time-to-goal).

---

### 6. Evaluation Metrics

*   Success Rate: Percentage of episodes where the agent reaches the Baritone final destination.
*   Path Following Error: Average deviation from Baritone's planned path.
*   Efficiency: Steps/time taken to complete tasks.
*   Robustness: Performance across diverse, never-before-seen generated parkour scenarios from different complexity levels. This could include scenarios with minor environmental perturbations that Baritone would re-path around, and the agent should adapt.