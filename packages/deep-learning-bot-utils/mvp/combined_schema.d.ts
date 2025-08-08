/**
 * Schema defining the structure of observation data (X) and Baritone's action (Y) for each tick in a training scenario.
 */
export type CombinedInputAndOutputDataSchema = TickData[];

export interface TickData {
    /**
     * Unique identifier for the game tick within the current Minecraft session.
     */
    tick_id: number;
    /**
     * Unix timestamp in milliseconds when this observation was recorded.
     */
    timestamp_ms: number;
    player_state: PlayerState;
    /**
     * A list of collision boxes from nearby environmental elements.
     */
    local_environment_scan: CollisionBox[];
    /**
     * A chronological list of the player's state for the last N ticks.
     */
    historical_player_states: HistoricalPlayerState[];
    baritone_action: BaritoneAction;
}

export interface Coordinates3D {
    x: number;
    y: number;
    z: number;
}

export interface Velocity3D {
    vx: number;
    vy: number;
    vz: number;
}

export interface LookDirection {
    yaw: number;
    pitch: number;
}

export type PlayerPose =
    | 'STANDING'
    | 'SNEAKING'
    | 'SPRINTING'
    | 'SWIMMING'
    | 'CRAWLING';

export interface PlayerState {
    position: Coordinates3D;
    velocity: Velocity3D;
    look_direction: LookDirection;
    player_pose: PlayerPose;
    ground_proximity: boolean;
    predicted_passive_next_tick_state: {
        predicted_pos: Coordinates3D;
        predicted_vel: Velocity3D;
    };
}

export interface BoundingBoxCoordinates {
    min_x: number;
    min_y: number;
    min_z: number;
    max_x: number;
    max_y: number;
    max_z: number;
}

export interface BoxDimensions {
    length: number;
    width: number;
    height: number;
}

export type TraversabilityData =
    | 'SOLID_WALKABLE'
    | 'FLUID'
    | 'OBSTRUCTION'
    | 'AIR'
    | 'LIQUID_PLACEABLE'
    | 'PLACEABLE_BLOCK'
    | 'SOLID_SLIPPERY'
    | 'NON_PHYSICAL'
    | 'OTHER';

export type AreaSourceType = 'FIXED_RADIUS' | 'DYNAMIC_INTEREST';

export interface CollisionBox {
    bounding_box_coordinates: BoundingBoxCoordinates;
    relative_position: Coordinates3D;
    box_dimensions: BoxDimensions;
    element_identifier: string;
    traversability_data: TraversabilityData;
    /**
     * Additional, block-specific properties (e.g., direction of stairs, open/closed doors).
     */
    element_state_properties: {
        [key: string]: any;
    };
    area_source_type: AreaSourceType;
    box_validity: boolean;
}

export interface HistoricalPlayerState {
    position: Coordinates3D;
    velocity: Velocity3D;
    look_direction: LookDirection;
    player_pose: PlayerPose;
    fall_distance: number;
}

/**
 * Schema defining the structure of Baritone's intended action output (Y for training).
 */
export interface BaritoneAction {
    /**
     * The primary direction of planar movement.
     */
    move_direction:
    | 'NONE'
    | 'FORWARD'
    | 'BACKWARD'
    | 'LEFT'
    | 'RIGHT'
    | 'FORWARD_LEFT'
    | 'FORWARD_RIGHT'
    | 'BACKWARD_LEFT'
    | 'BACKWARD_RIGHT';
    /**
     * Relative change in look direction from the current look_direction.
     */
    look_change: {
        /**
         * Change in yaw (horizontal rotation) in degrees.
         */
        yaw: number;
        /**
         * Change in pitch (vertical rotation) in degrees.
         */
        pitch: number;
    };
    /**
     * Whether the jump action is being performed.
     */
    jump: boolean;
    /**
     * Whether the sneak (crouch) action is being toggled/held.
     */
    sneak: boolean;
    /**
     * Whether the sprint action is being toggled/held.
     */
    sprint: boolean;
}