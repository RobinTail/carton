import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { Sphere, Vector3, type PerspectiveCamera } from "three";
import type { BoxParams, Layout } from "../lib/geometry.ts";
import { buildModel, type BoxModel, type Slab } from "../lib/model3d.ts";
import { PreviewNotice } from "./PreviewNotice.tsx";
import "./Box3D.css";

const ACTION = CameraControlsImpl.ACTION;

const SURFACE = {
  outer: { color: "#cda271", opacity: 1, roughness: 0.85 },
  inner: { color: "#a87c4c", opacity: 1, roughness: 0.85 },
  // Translucent tan, and glossier than board — it should read as film.
  tape: { color: "#b07c3a", opacity: 0.55, roughness: 0.35 },
} as const;

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

        {model.slabs.map((slab) => (
          <SlabMesh key={slab.id} slab={slab} />
        ))}

        <Frame model={model} />
      </Canvas>
    </div>
  );
}

function SlabMesh({ slab }: { slab: Slab }) {
  const surface = SURFACE[slab.tone];
  const translucent = surface.opacity < 1;

  return (
    <mesh position={slab.position} rotation={slab.rotation}>
      <boxGeometry args={slab.size} />
      <meshStandardMaterial
        color={surface.color}
        roughness={surface.roughness}
        metalness={0}
        transparent={translucent}
        opacity={surface.opacity}
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
