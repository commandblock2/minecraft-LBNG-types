### Bot Training Session Specification

**Objective:** Define the training methodology for a Minecraft bot using offline reinforcement learning with Baritone pathfinding as reference attention for collision box exploration.

**Core Training Philosophy:**

1. **Offline RL Approach:** Decouple data collection from training to enable batch learning and safer experimentation.
2. **Hierarchical Learning:** Separate movement execution from path planning through two-phase training.
3. **Baritone as Reference Teacher:** Use Baritone's A* pathfinding as ground truth for "area of interest" generation.
4. **Progressive Environment Complexity:** Start with simple environments and gradually increase difficulty.

---

#### **Training Architecture Overview**

The training process consists of two main phases that can be trained separately or jointly:

1. **Phase 1: Movement Execution Training**
   - Focus: Learn low-level movement actions to follow a given path
   - Input: Current state + area of interest (collision boxes around target path)
   - Output: Movement actions (forward/backward, strafe, jump, etc.)
   - Teacher: Human demonstrations or scripted optimal movements

2. **Phase 2: Path Interest Generation Training**
   - Focus: Learn to output optimal "areas of interest" for detailed environmental scanning
   - Input: Current state + goal information
   - Output: Path of interest (sequence of blocks/waypoints)
   - Teacher: Baritone's A* pathfinding output

---

#### **Data Collection Methodology**

**Environment Generation:**
- **Level 1:** Flat terrain with simple A-to-B navigation
- **Level 2:** Single-block-wide bridges
- **Level 3:** Bridges with gaps requiring jumping
- **Level 4:** Complex terrain with multiple path options
- **Level 5:** Dynamic obstacles and moving platforms

**Data Collection Process:**

1. **Environment Setup:**
   - Generate scripted environment (flat/bridge/complex)
   - Set start position and goal position
   - Initialize Baritone pathfinding to goal

2. **Per-Tick Data Capture:**
   - Capture player state (position, velocity, pose, etc.)
   - Capture local environment scan (fixed radius around player)
   - Query Baritone for current optimal path to goal
   - Capture collision boxes around Baritone's path (dynamic area of interest)
   - Record actual player/bot actions taken
   - Calculate rewards based on progress and safety

3. **Data Storage Outline:**
   - Player state vectors
   - Environment collision box data (fixed + dynamic)
   - Baritone reference path data
   - Action vectors taken
   - Reward signals
   - Metadata (environment type, tick, session ID)

**Baritone Integration Details:**

1. **Path Extraction:**
   - Query Baritone's pathfinding system for complete path to goal
   - Extract waypoint sequence as BlockPos coordinates
   - Calculate collision boxes around each waypoint (configurable radius)

2. **Dynamic Area of Interest:**
   - Fixed radius scan: 8-block radius around player (as in current bbox-logger)
   - Dynamic scan: Collision boxes around Baritone's path waypoints
   - Combined input: Fixed + Dynamic collision box data

3. **Reference Attention Mechanism:**
   - Baritone's path serves as "ground truth" for where the bot should focus attention
   - Neural network learns to predict similar area-of-interest outputs
   - Training objective: Minimize difference between NN output and Baritone's path

---

#### **Training Phases**

**Phase 1: Movement Execution Training**

*Objective:* Train the bot to execute low-level movements to follow a given path.

*Training Setup:*
- Input State: Player state + Local environment + **Given** area of interest (from Baritone)
- Target Actions: Optimal movement actions to progress along the path
- Loss Function: MSE on movement actions + reward-based RL loss

*Data Requirements:*
- State-action pairs where area of interest is provided by Baritone
- Reward signals for path following, collision avoidance, goal progress
- Multiple environment types for generalization

**Phase 2: Path Interest Generation Training**

*Objective:* Train the bot to predict optimal areas of interest for environmental scanning.

*Training Setup:*
- Input State: Player state + Local environment + Goal information
- Target Output: Area of interest coordinates (matching Baritone's path)
- Loss Function: Spatial distance loss between predicted and Baritone paths

*Data Requirements:*
- State observations paired with Baritone's optimal path outputs
- Various goal configurations and environment layouts
- Path optimality metrics for evaluation

---

#### **Reward Function Design**

**Movement Phase Rewards:**
- **Path Following:** Distance to nearest waypoint on target path
- **Progress:** Forward movement toward goal
- **Collision Avoidance:** Penalty for hitting obstacles
- **Efficiency:** Bonus for reaching waypoints quickly

**Path Interest Phase Rewards:**
- **Path Accuracy:** Similarity to Baritone's optimal path
- **Exploration Efficiency:** Coverage of relevant areas
- **Computational Cost:** Penalty for overly complex paths

---

#### **Training Pipeline**

1. **Data Collection Sessions:**
   - Run scripted environments with Baritone pathfinding
   - Collect state-action-reward tuples
   - Store in compressed format for offline training

2. **Offline Training:**
   - Load collected datasets
   - Train Phase 1 (movement) and Phase 2 (path interest) networks
   - Use standard RL algorithms (PPO, SAC, etc.) or supervised learning

3. **Evaluation:**
   - Test on held-out environments
   - Measure path following accuracy, goal completion rate
   - Compare against Baritone baseline performance

4. **Iterative Improvement:**
   - Collect additional data in areas where bot performs poorly
   - Retrain with augmented datasets
   - Gradually increase environment complexity

---

#### **Implementation Considerations**

**Baritone API Requirements:**
- Access to computed path waypoints
- Real-time path updates when environment changes
- Ability to set custom goals and constraints

**Data Collection Infrastructure:**
- Automated environment generation scripts
- Efficient collision box extraction and storage
- Parallel data collection across multiple game instances

**Training Infrastructure:**
- Support for large-scale offline RL training
- Model checkpointing and evaluation pipelines
- Distributed training for faster iteration cycles