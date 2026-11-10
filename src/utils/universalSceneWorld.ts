/**
 * Universal Scene World Contract (v1)
 *
 * Provider-neutral scene graph contract. Any LLM (Gemini, OpenAI, Claude, local)
 * can produce this JSON; renderers consume it without knowing which model authored it.
 * Coordinates are meters, Y-up, right-handed. Times are seconds from scene start.
 */

export type Vec3 = { x: number; y: number; z: number };
export type WorldEntityKind =
  | 'character' | 'prop' | 'architecture' | 'nature' | 'vehicle'
  | 'terrain' | 'light' | 'vfx' | 'decoration';

export type WorldTransform = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
};

export interface WorldEntity {
  id: string;
  kind: WorldEntityKind;
  /** Stable semantic key, e.g. "kitchen.counter", "tree.oak", "vehicle.bus". */
  assetKey: string;
  label: string;
  transform: WorldTransform;
  /** Renderer-neutral material hints. Asset packs may override these. */
  appearance?: {
    color?: string;
    material?: 'wood' | 'metal' | 'glass' | 'stone' | 'fabric' | 'plastic' | 'organic' | 'concrete';
    roughness?: number;
    metalness?: number;
  };
  tags?: string[];
  /** Optional bounding dimensions in meters, used for framing and contact planning. */
  bounds?: Vec3;
  required?: boolean;
}

export type InteractionVerb =
  | 'walk_to' | 'look_at' | 'reach' | 'grab' | 'release' | 'carry'
  | 'push' | 'pull' | 'open' | 'close' | 'sit' | 'stand'
  | 'climb' | 'jump_to' | 'throw' | 'hand_over' | 'use' | 'custom';

export interface WorldInteraction {
  id: string;
  actorId: string;
  targetId: string;
  verb: InteractionVerb;
  start: number;
  end: number;
  /** Named contact point: handle, seat, top, side, floor, etc. */
  contactPoint?: string;
  /** Plain-language intent for animation adapters. */
  intent?: string;
  required?: boolean;
}

export interface WorldShot {
  start: number;
  end: number;
  type: 'establishing' | 'wide' | 'medium' | 'close_up' | 'over_shoulder' | 'tracking' | 'low_angle' | 'high_angle';
  subjectIds: string[];
  movement?: 'static' | 'pan' | 'tilt' | 'dolly' | 'orbit' | 'handheld';
  /** Optional look-at entity; camera adapter resolves actual coordinates. */
  lookAtId?: string;
}

export interface UniversalWorldPlan {
  schemaVersion: '1.0';
  sceneId: string;
  duration: number;
  environment: {
    description: string;
    locationType: string;
    visualStyle: string;
    timeOfDay?: string;
    weather?: string;
    lightingMood?: string;
    ground?: string;
  };
  entities: WorldEntity[];
  interactions: WorldInteraction[];
  shots: WorldShot[];
  notes?: string[];
}

export interface WorldPlanValidation {
  valid: boolean;
  plan?: UniversalWorldPlan;
  errors: string[];
  warnings: string[];
}

const ENTITY_KINDS: readonly WorldEntityKind[] = [
  'character', 'prop', 'architecture', 'nature', 'vehicle',
  'terrain', 'light', 'vfx', 'decoration',
];
const INTERACTION_VERBS: readonly InteractionVerb[] = [
  'walk_to', 'look_at', 'reach', 'grab', 'release', 'carry', 'push', 'pull',
  'open', 'close', 'sit', 'stand', 'climb', 'jump_to', 'throw', 'hand_over', 'use', 'custom',
];
const MATERIALS = ['wood', 'metal', 'glass', 'stone', 'fabric', 'plastic', 'organic', 'concrete'] as const;
const CAMERA_MOVEMENTS = ['static', 'pan', 'tilt', 'dolly', 'orbit', 'handheld'] as const;
const SHOT_TYPES: readonly WorldShot['type'][] = [
  'establishing', 'wide', 'medium', 'close_up', 'over_shoulder',
  'tracking', 'low_angle', 'high_angle',
];

const isRecord = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const vec = (v: any, fallback: Vec3): Vec3 => ({
  x: finite(v?.x) ? v.x : fallback.x,
  y: finite(v?.y) ? v.y : fallback.y,
  z: finite(v?.z) ? v.z : fallback.z,
});
const slug = (v: string, fallback: string) =>
  v.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || fallback;

/**
 * Validates and normalizes untrusted model output. Never executes model-provided code,
 * URLs, shaders, scripts, or arbitrary component names.
 */
export function validateUniversalWorldPlan(input: unknown): WorldPlanValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ['Plan must be a JSON object.'], warnings };

  const duration = finite(input.duration) ? clamp(input.duration, 0.5, 600) : 8;
  if (!finite(input.duration)) warnings.push('Missing/invalid duration; defaulted to 8 seconds.');
  const rawEntities = Array.isArray(input.entities) ? input.entities : [];
  if (rawEntities.length > 160) errors.push('A scene may contain at most 160 entities.');
  const entities: WorldEntity[] = [];
  const ids = new Set<string>();

  for (const [index, raw] of rawEntities.slice(0, 160).entries()) {
    if (!isRecord(raw)) { warnings.push(`Entity ${index} ignored: not an object.`); continue; }
    const id = slug(String(raw.id || ''), `entity_${index + 1}`);
    if (ids.has(id)) { errors.push(`Duplicate entity id: ${id}`); continue; }
    if (!ENTITY_KINDS.includes(raw.kind)) { warnings.push(`Entity ${id} ignored: unsupported kind.`); continue; }
    ids.add(id);
    const transform = isRecord(raw.transform) ? raw.transform : {};
    const scale = vec(transform.scale, { x: 1, y: 1, z: 1 });
    scale.x = clamp(Math.abs(scale.x), 0.01, 100);
    scale.y = clamp(Math.abs(scale.y), 0.01, 100);
    scale.z = clamp(Math.abs(scale.z), 0.01, 100);
    const appearance = isRecord(raw.appearance) ? raw.appearance : undefined;
    entities.push({
      id,
      kind: raw.kind,
      assetKey: isText(raw.assetKey) ? raw.assetKey.trim().slice(0, 120) : `generic.${raw.kind}`,
      label: isText(raw.label) ? raw.label.trim().slice(0, 120) : id,
      transform: {
        position: vec(transform.position, { x: 0, y: 0, z: 0 }),
        rotation: vec(transform.rotation, { x: 0, y: 0, z: 0 }),
        scale,
      },
      ...(appearance ? { appearance: {
        ...(isText(appearance.color) ? { color: appearance.color.slice(0, 32) } : {}),
        ...(MATERIALS.includes(appearance.material) ? { material: appearance.material } : {}),
        ...(finite(appearance.roughness) ? { roughness: clamp(appearance.roughness, 0, 1) } : {}),
        ...(finite(appearance.metalness) ? { metalness: clamp(appearance.metalness, 0, 1) } : {}),
      } } : {}),
      ...(Array.isArray(raw.tags) ? { tags: raw.tags.filter(isText).slice(0, 20).map((x: string) => x.slice(0, 40)) } : {}),
      ...(isRecord(raw.bounds) ? { bounds: vec(raw.bounds, { x: 1, y: 1, z: 1 }) } : {}),
      ...(typeof raw.required === 'boolean' ? { required: raw.required } : {}),
    });
  }

  const entityIds = new Set(entities.map(e => e.id));
  const rawInteractions = Array.isArray(input.interactions) ? input.interactions : [];
  if (rawInteractions.length > 240) errors.push('A scene may contain at most 240 interactions.');
  const interactions: WorldInteraction[] = [];
  for (const [index, raw] of rawInteractions.slice(0, 240).entries()) {
    if (!isRecord(raw) || !isText(raw.actorId) || !isText(raw.targetId) || !INTERACTION_VERBS.includes(raw.verb)) {
      warnings.push(`Interaction ${index} ignored: malformed or unsupported.`); continue;
    }
    const actorId = slug(raw.actorId, '');
    const targetId = slug(raw.targetId, '');
    if (!entityIds.has(actorId) || !entityIds.has(targetId)) {
      warnings.push(`Interaction ${index} ignored: actor/target entity is missing.`); continue;
    }
    const start = finite(raw.start) ? clamp(raw.start, 0, duration) : 0;
    const end = finite(raw.end) ? clamp(raw.end, start, duration) : duration;
    interactions.push({
      id: slug(String(raw.id || ''), `interaction_${index + 1}`),
      actorId, targetId, verb: raw.verb, start, end,
      ...(isText(raw.contactPoint) ? { contactPoint: raw.contactPoint.slice(0, 80) } : {}),
      ...(isText(raw.intent) ? { intent: raw.intent.slice(0, 240) } : {}),
      ...(typeof raw.required === 'boolean' ? { required: raw.required } : {}),
    });
  }

  const rawShots = Array.isArray(input.shots) ? input.shots : [];
  const shots: WorldShot[] = [];
  for (const [index, raw] of rawShots.slice(0, 80).entries()) {
    if (!isRecord(raw) || !SHOT_TYPES.includes(raw.type)) {
      warnings.push(`Shot ${index} ignored: unsupported type.`); continue;
    }
    const start = finite(raw.start) ? clamp(raw.start, 0, duration) : 0;
    const end = finite(raw.end) ? clamp(raw.end, start, duration) : duration;
    const subjectIds = Array.isArray(raw.subjectIds)
      ? raw.subjectIds.filter(isText).map((x: string) => slug(x, '')).filter((x: string) => entityIds.has(x))
      : [];
    shots.push({
      start, end, type: raw.type, subjectIds,
      ...(CAMERA_MOVEMENTS.includes(raw.movement) ? { movement: raw.movement } : {}),
      ...(isText(raw.lookAtId) && entityIds.has(slug(raw.lookAtId, '')) ? { lookAtId: slug(raw.lookAtId, '') } : {}),
    });
  }

  if (!entities.some(e => e.kind === 'character')) warnings.push('No character entity was defined.');
  if (!entities.some(e => e.kind === 'architecture' || e.kind === 'terrain')) warnings.push('No structural/environment entity was defined.');
  if (!interactions.length) warnings.push('No explicit physical interactions; characters may appear disconnected from the world.');
  if (!shots.length) shots.push({ start: 0, end: duration, type: 'wide', subjectIds: entities.filter(e => e.kind === 'character').map(e => e.id), movement: 'static' });

  const environment = isRecord(input.environment) ? input.environment : {};
  const plan: UniversalWorldPlan = {
    schemaVersion: '1.0',
    sceneId: slug(String(input.sceneId || 'scene'), 'scene'),
    duration,
    environment: {
      description: isText(environment.description) ? environment.description.slice(0, 500) : 'Unspecified environment',
      locationType: isText(environment.locationType) ? environment.locationType.slice(0, 80) : 'custom',
      visualStyle: isText(environment.visualStyle) ? environment.visualStyle.slice(0, 80) : 'stylized_3d',
      ...(isText(environment.timeOfDay) ? { timeOfDay: environment.timeOfDay.slice(0, 40) } : {}),
      ...(isText(environment.weather) ? { weather: environment.weather.slice(0, 80) } : {}),
      ...(isText(environment.lightingMood) ? { lightingMood: environment.lightingMood.slice(0, 80) } : {}),
      ...(isText(environment.ground) ? { ground: environment.ground.slice(0, 100) } : {}),
    },
    entities, interactions, shots,
    ...(Array.isArray(input.notes) ? { notes: input.notes.filter(isText).slice(0, 20).map((x: string) => x.slice(0, 240)) } : {}),
  };

  return { valid: errors.length === 0, ...(errors.length === 0 ? { plan } : {}), errors, warnings };
}

/** Starter asset vocabulary. Keys are semantic; actual geometry comes from registered asset packs. */
export const UNIVERSAL_ASSET_STARTER_PACK = [
  'architecture.wall', 'architecture.door', 'architecture.window', 'architecture.floor',
  'kitchen.counter', 'kitchen.cabinet', 'kitchen.sink', 'kitchen.stove', 'kitchen.fridge', 'kitchen.table', 'kitchen.chair',
  'street.road', 'street.sidewalk', 'street.lamp', 'street.traffic_light', 'street.building',
  'school.desk', 'school.whiteboard', 'school.locker', 'school.chair',
  'sports.hoop', 'sports.goal', 'sports.ball', 'sports.bench',
  'nature.tree', 'nature.bush', 'nature.rock', 'nature.grass',
  'vehicle.car', 'vehicle.bus', 'vehicle.truck', 'vehicle.bicycle',
  'prop.box', 'prop.book', 'prop.phone', 'prop.cup', 'prop.backpack',
] as const;
