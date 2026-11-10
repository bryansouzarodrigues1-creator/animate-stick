# Universal scene world — architecture and tool decisions

## Why this exists
The current 3D stage is specialized around a military convoy. A model can select a supported theme/action, but that is not the same as being able to compose an arbitrary world. This contract separates **what the AI describes** from **how a renderer builds it**.

## v1 implemented in this branch
- `src/utils/universalSceneWorld.ts`: provider-neutral JSON contract, semantic asset keys, entities, physical interactions, shot timeline, limits and validation.
- `POST /api/ai/scene-world-plan`: Gemini adapter that asks for a generic scene graph rather than one of the old hard-coded environment enums.
- `POST /api/scene-world/validate`: provider-neutral endpoint. Gemini, OpenAI, Claude, a local model, or a human-authored tool can submit the same JSON plan.
- `src/utils/universalSceneWorld.test.ts`: contract tests for a kitchen, missing references, clamping and entity limits.

This is the **planning/API foundation**, not yet the renderer integration. The existing ThreeStageEngine still needs to consume entities and interactions, load real assets, and replace its hard-coded military-only initialization. Do not claim arbitrary scenes are already fully rendered.

## Target pipeline
1. Prompt + story bible -> AI director (any provider adapter).
2. AI emits UniversalWorldPlan JSON; validate and repair missing references.
3. Asset resolver maps semantic keys to licensed GLB/GLTF assets or procedural fallback geometry.
4. Scene assembler builds terrain, architecture, props, lights and characters.
5. Interaction executor resolves actor/target/contact points and drives character rig + physics.
6. Camera director derives shot framing from action and subjects.
7. Deterministic timeline renderer evaluates exact timestamps.
8. FFmpeg muxes frames, narration, music and effects into a correctly labelled MP4/WebM.

## Infrastructure and tools: recommended order

### 1. Keep Three.js; add GLB/GLTF asset loading
Use Three.js `GLTFLoader` and make glTF/GLB the canonical runtime asset format. Models can contain meshes, materials, textures, skins, skeletons and animations. Build an asset manifest with semantic keys, license, source, file size, bounds, scale, LOD and animation names. Cache loaded assets and dispose textures/geometries when no longer needed.
- Docs: https://threejs.org/docs/pages/GLTFLoader.html
- Workflow: https://threejs.org/manual/pages/loading-3d-models.html

### 2. Real contact and physics: Rapier
Evaluate `@dimforge/rapier3d` for rigid bodies, colliders, joints, collision events and scene queries. Use physics selectively: props, doors, boxes, vehicles, falling debris and contact validation. Do not simulate every character bone as a fully dynamic ragdoll; keep authored animation/IK for characters and use physics for secondary motion.
- Docs: https://rapier.rs/docs/user_guides/javascript/getting_started_js/
- Package: https://www.npmjs.com/package/@dimforge/rapier3d

### 3. Asset creation without hand-coding every object
- Poly Haven: CC0 HDRIs, textures and models; useful baseline library, but verify each downloaded asset's metadata and optimize it before shipping. https://polyhaven.com/license
- Meshy API: text/image-to-3D, preview then refine, GLB export; useful for missing one-off props and set pieces. Put API key on server only, run jobs asynchronously, store generated files in object storage, and track credit cost. https://docs.meshy.ai/en/api/text-to-3d
- Blender: batch cleanup, scale/origin correction, decimation, material fixes, LOD and GLB export using Python/background mode. https://docs.blender.org/manual/en/5.0/advanced/command_line/arguments.html
- Do not generate every object with AI. Prefer curated reusable asset packs; use generation only for gaps and distinctive hero assets.

### 4. Video output
Keep browser preview for iteration. For final export, prefer server/worker rendering at fixed frame timestamps and FFmpeg for encoding/muxing. This prevents browser FPS from defining the duration and lets us verify codec, audio and file extension. Remotion is an option if the product moves toward React-driven 2D overlays/titles and server-side composition, but it is not a replacement for the 3D world engine.
- FFmpeg: https://www.ffmpeg.org/documentation.html
- Remotion: https://www.remotion.dev/docs/render
- Blender background rendering: https://docs.blender.org/manual/en/5.0/advanced/command_line/arguments.html

### 5. Provider abstraction
Define one internal interface for scene planning, with adapters for Gemini, OpenAI and other models. The renderer must never depend on a provider's proprietary response shape. Validate all model output; never execute generated JavaScript, Python, shaders or arbitrary URLs. Provider keys remain server-side.

## Performance tiers
For the target Dell-class integrated-GPU / 8 GB RAM device, make preview adaptive:
- Draft: 540p/30, low shadows, low-poly proxies, small asset budget.
- Standard: 720p/30, selective shadows, compressed GLB and texture limits.
- Final: render on a separate worker or external render service; do not require the user's laptop to render heavy scenes.
Use instancing for repeated trees/chairs/crowds, lazy-load assets by shot, cap texture sizes, and provide graceful fallbacks.

## Acceptance gates before saying "any scenario works"
- Kitchen, school, street and sports court are generated from prompts without hard-coded scene branches.
- A character walks to a target, reaches the correct contact point, grabs it, and the object follows the hand.
- Doors open around hinges; characters sit on seats without floating; feet stay planted.
- Camera never clips a character or important prop; framing follows the active beat.
- Identical plan + seed + timestamp produces the same pose and camera.
- Exported file's extension matches actual container/codec; audio starts and ends in sync.
- Save visual evidence (screenshots/video) and test logs. TypeScript unit tests alone do not prove visual quality.

## Security and licensing
- Never expose Meshy or model-provider keys in frontend code.
- Treat model JSON as untrusted input; validate lengths, enum values, entity counts and references.
- Store asset source, license, author and acquisition date in the manifest. Do not scrape arbitrary models or assume a marketplace asset is commercially reusable.
- Do not allow AI output to supply executable code, shader source, or arbitrary fetch URLs.
