import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  CameraControls,
  CameraControlsImpl,
  useTexture,
} from "@react-three/drei";
import {
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Sphere,
  Vector3,
  type MeshStandardMaterialParameters,
  type PerspectiveCamera,
  type Texture,
} from "three";
import type { BoxParams, Layout } from "../lib/geometry.ts";
import {
  buildModel,
  TAPE_WIDTH,
  X,
  Y,
  Z,
  type Axis,
  type BoxModel,
  type Slab,
  type Tone,
} from "../lib/model3d.ts";
import { PreviewNotice } from "./PreviewNotice.tsx";
import "./Box3D.css";

const ACTION = CameraControlsImpl.ACTION;

/**
 * Paper scan driving the board surface. No displacement map: displacement is a
 * vertex effect, and a `boxGeometry` has only its eight corners to move, so it
 * would skew the slab rather than add any relief. The normal map does that job
 * on flat geometry.
 */
const BOARD_MAPS = {
  map: "/paper_0025_color_1k.jpg",
  aoMap: "/paper_0025_ao_1k.jpg",
  roughnessMap: "/paper_0025_roughness_1k.jpg",
  normalMap: "/paper_0025_normal_opengl_1k.jpg",
} as const;

const TAPE_MAPS = {
  map: "/tape_0012_color_1k.jpg",
  aoMap: "/tape_0012_ao_1k.jpg",
  roughnessMap: "/tape_0012_roughness_1k.jpg",
  normalMap: "/tape_0012_normal_opengl_1k.jpg",
} as const;

type MapSet = Record<keyof typeof BOARD_MAPS, Texture>;
type Material = "board" | "tape";
type Surfaces = Record<Material, MapSet>;

/**
 * Millimetres of real surface covered by one tile of each scan. The tape tile
 * is set to the roll width, so a strip gets exactly one tile across it and
 * repeats only along its length — the way a real strip looks.
 */
const TILE: Record<Material, number> = { board: 150, tape: TAPE_WIDTH };

// With a map bound, `color` and `roughness` become multipliers over it rather
// than the appearance itself. The two board tones stay well apart: the contrast
// between them is what shows which bottom flap laps over which.
const SURFACE: Record<Tone, MeshStandardMaterialParameters> = {
  outer: { color: "#f1ece7", roughness: 0.95 },
  inner: { color: "#e6dcd1", roughness: 0.95 },
  // Untinted — the scan carries its own tan. Translucent, and glossier than
  // board, so it reads as film.
  tape: { opacity: 0.35, roughness: 0.15 },
};

const FOV = 40;
/**
 * Direction the camera sits in on first mount — a three-quarter view. Only the
 * direction matters: `fitToSphere` sets the distance.
 */
const DEFAULT_VIEW: [number, number, number] = [0.75, 0.55, 1];

export function Box3D({
  layout,
  params,
}: {
  layout: Layout;
  params: BoxParams;
}) {
  const model = buildModel(layout, params);
  const [lost, setLost] = useState(false);

  // A context can be yanked away after a successful start — a driver reset, or
  // the browser reclaiming contexts. That never throws, so no error boundary
  // would see it; the canvas just goes blank.
  if (lost) {
    return (
      <PreviewNotice title="The 3D context was lost">
        The graphics driver dropped the canvas. Switch to the Flat tab and back
        to try again.
      </PreviewNotice>
    );
  }

  return (
    <div className="box3d">
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: FOV, position: DEFAULT_VIEW }}
        // Millimetre-scale geometry, so the camera is metres away in world units.
        gl={{ antialias: true }}
        onCreated={({ gl }) =>
          gl.domElement.addEventListener("webglcontextlost", () =>
            setLost(true),
          )
        }
      >
        <hemisphereLight args={["#fffaf2", "#5b5347", 1.4]} />
        <directionalLight position={[2, 3, 2]} intensity={2.2} />
        <directionalLight position={[-2, 1, -1.5]} intensity={0.7} />
        {/* Underside fill. Neither key nor rim reaches the bottom flaps, which
            are the whole point of the model and are visible whenever the camera
            drops below the horizon. Warm and dim, so it reads as bounce. */}
        <directionalLight
          position={[0.5, -3, 1]}
          intensity={0.7}
          color="#ffeedd"
        />

        {/* The board suspends on its textures. Nothing renders until they land,
            so the box never appears untextured and then pops; the fallback has
            to be scene content, hence null rather than a message. */}
        <Suspense fallback={null}>
          <Board model={model} />
        </Suspense>

        <Frame model={model} />
      </Canvas>
    </div>
  );
}

/** Every slab of the box, sharing one loaded scan per material. */
function Board({ model }: { model: BoxModel }) {
  const surfaces = useSurfaces();

  return (
    <>
      {model.slabs.map((slab) => (
        <SlabMesh key={slab.id} slab={slab} surfaces={surfaces} />
      ))}
    </>
  );
}

/**
 * Loads both scans. Must run inside the Canvas: `useTexture` reaches for the
 * renderer through `useThree`. Suspends until every map has arrived, and a
 * missing file rejects into the error boundary around `Box3D` rather than
 * failing silently to the console.
 */
function useSurfaces(): Surfaces {
  const board = useMapSet(BOARD_MAPS);
  const tape = useMapSet(TAPE_MAPS);

  return useMemo(() => ({ board, tape }), [board, tape]);
}

function useMapSet(urls: Record<string, string>): MapSet {
  const { map, aoMap, roughnessMap, normalMap } = useTexture(urls) as MapSet;

  // useLoader caches by URL, so the textures themselves are stable — but the
  // record wrapping them is rebuilt every render, and the per-slab tiling below
  // memoises against it.
  return useMemo(
    () => ({ map, aoMap, roughnessMap, normalMap }),
    [map, aoMap, roughnessMap, normalMap],
  );
}

/**
 * Which world axes the broad face of a slab runs U and V along.
 *
 * Every slab is a thin sheet, so its broad face is the one perpendicular to its
 * smallest axis. BoxGeometry pairs axes to UV per face and the pairing is not
 * the same for all three: `±X` runs U along z and V along y, `±Y` runs U along
 * x and V along z, `±Z` runs U along x and V along y. Taking the two largest
 * dimensions in size order matches that only by luck, and gets `±X` backwards
 * whenever the slab is taller than it is deep — which stretches the grain along
 * one axis until the board reads as wood.
 */
function faceAxes([x, y, z]: readonly number[]): [Axis, Axis] {
  const thinnest = Math.min(x, y, z);
  if (thinnest === x) return [Z, Y];
  if (thinnest === y) return [X, Z];
  return [X, Y];
}

/**
 * Copies the shared maps and tiles them to the slab's broad face, so the scan
 * reads at one physical scale whether the panel is 316 mm across or 3 mm. Left
 * untiled, every face gets a single stretched copy and the thin edges smear.
 *
 * A slab with a `grain` turns its scan a quarter turn when the face's U axis is
 * not the one the material runs along — otherwise the tape on the walls comes
 * out crossways to the tape on the floor, because those faces pair axes to UV
 * differently.
 *
 * Clones share the underlying `Source`, so the GPU upload is shared too — only
 * the transform, which is a shader uniform, differs.
 */
function tileToSlab(
  set: MapSet,
  size: readonly number[],
  tile: number,
  grain?: Axis,
): MapSet {
  const [uAxis, vAxis] = faceAxes(size);
  const turned = grain !== undefined && grain !== uAxis;
  // Turning swaps which span drives which repeat: after a quarter turn the
  // scan's own U axis is laid along the face's V.
  const [across, down] = turned
    ? [size[vAxis], size[uAxis]]
    : [size[uAxis], size[vAxis]];

  const tiled = {} as MapSet;

  for (const key of Object.keys(set) as (keyof MapSet)[]) {
    const texture = set[key].clone();
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(across / tile, down / tile);
    if (turned) {
      texture.center.set(0.5, 0.5);
      texture.rotation = Math.PI / 2;
    }
    texture.colorSpace = key === "map" ? SRGBColorSpace : NoColorSpace;
    tiled[key] = texture;
  }

  return tiled;
}

function SlabMesh({ slab, surfaces }: { slab: Slab; surfaces: Surfaces }) {
  const surface = SURFACE[slab.tone];
  const translucent = (surface.opacity ?? 1) < 1;
  const material: Material = slab.tone === "tape" ? "tape" : "board";
  // Primitives, not the array: `buildModel` rebuilds its slabs every render.
  const [sizeX, sizeY, sizeZ] = slab.size;

  const maps = useMemo(
    () =>
      tileToSlab(
        surfaces[material],
        [sizeX, sizeY, sizeZ],
        TILE[material],
        slab.grain,
      ),
    [surfaces, material, sizeX, sizeY, sizeZ, slab.grain],
  );

  // Editing a dimension re-tiles, so the superseded clones have to go back.
  useEffect(
    () => () => {
      for (const texture of Object.values(maps)) texture.dispose();
    },
    [maps],
  );

  return (
    <mesh position={slab.position} rotation={slab.rotation}>
      <boxGeometry args={slab.size} />
      <meshStandardMaterial
        {...surface}
        {...maps}
        transparent={translucent}
        // Without this a translucent slab occludes its own far side, so the
        // strip darkens wherever the camera sees through two of its faces.
        depthWrite={!translucent}
      />
    </mesh>
  );
}

/**
 * Frames the camera on the model and drives the orbit controls.
 *
 * Only the first fit places the camera. After that a dimension change keeps
 * whatever viewpoint the user has orbited to, re-centring on the new box and
 * scaling the distance in step with it — so the angle and the apparent size
 * both survive, and editing a dimension does not throw away the view.
 */
function Frame({ model }: { model: BoxModel }) {
  const controls = useRef<CameraControls>(null);
  const placed = useRef(false);
  const lastRadius = useRef(0);
  const [extentX, extentY, extentZ] = model.extent;

  useEffect(() => {
    const camera = controls.current;
    if (!camera) return;

    const radius = Math.hypot(extentX, extentY, extentZ) / 2;
    const centre = new Vector3(0, extentY / 2, 0);
    const maxDistance = radius * 8;

    camera.minDistance = radius * 0.8;
    camera.maxDistance = maxDistance;

    // CameraControls drives position and target only — the clipping planes are
    // still ours. The defaults (0.1 / 1000) are calibrated for a scene measured
    // in metres; ours is in millimetres, so a box a few hundred wide sits
    // partly beyond `far` and its far corner gets clipped to the background.
    const lens = camera.camera as PerspectiveCamera;
    lens.near = radius / 100;
    lens.far = maxDistance + radius * 2;
    lens.updateProjectionMatrix();

    if (!placed.current) {
      // Frames from wherever the camera already points, which is the canvas's
      // initial position — hence DEFAULT_VIEW as its starting coordinates.
      camera.fitToSphere(new Sphere(centre, radius), false);
      placed.current = true;
    } else {
      // Offset from the old target carries the user's angle and how far they
      // have zoomed. Scaling it by the change in radius keeps the box the same
      // apparent size, and re-applying it from the new centre leaves the
      // direction untouched.
      const offset = camera
        .getPosition(new Vector3())
        .sub(camera.getTarget(new Vector3()))
        .multiplyScalar(
          lastRadius.current > 0 ? radius / lastRadius.current : 1,
        )
        .add(centre);
      camera.setLookAt(...offset.toArray(), ...centre.toArray(), true);
    }

    lastRadius.current = radius;
  }, [extentX, extentY, extentZ]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      // Rotate and dolly only — panning would let the box drift off-screen.
      mouseButtons={{
        left: ACTION.ROTATE,
        middle: ACTION.DOLLY,
        right: ACTION.NONE,
        wheel: ACTION.DOLLY,
      }}
      touches={{
        one: ACTION.TOUCH_ROTATE,
        two: ACTION.TOUCH_DOLLY,
        three: ACTION.NONE,
      }}
    />
  );
}
