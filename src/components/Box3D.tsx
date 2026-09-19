import { useEffect, useRef, useState } from "react";
import {
  Canvas,
  extend,
  useFrame,
  useStore,
  type ThreeElement,
} from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BoxParams, Layout } from "../lib/geometry.ts";
import { buildModel, type BoxModel, type Slab } from "../lib/model3d.ts";
import { PreviewNotice } from "./PreviewNotice.tsx";
import "./Box3D.css";

// Pulled in directly rather than via @react-three/drei, which would be a whole
// dependency for one control.
extend({ OrbitControls });

declare module "@react-three/fiber" {
  interface ThreeElements {
    orbitControls: ThreeElement<typeof OrbitControls>;
  }
}

const SURFACE = {
  outer: { color: "#cda271", opacity: 1, roughness: 0.85 },
  inner: { color: "#a87c4c", opacity: 1, roughness: 0.85 },
  // Translucent tan, and glossier than board — it should read as film.
  tape: { color: "#b07c3a", opacity: 0.55, roughness: 0.35 },
} as const;

const FOV = 40;
/** Direction the camera sits in on first mount — a three-quarter view. */
const DEFAULT_VIEW = new Vector3(0.75, 0.55, 1).normalize();

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
        camera={{ fov: FOV, position: [1, 1, 1] }}
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
  // The camera and canvas are fixed for the Canvas's lifetime, so reading them
  // off the store is a stable, non-reactive read — and taking the camera at
  // effect time rather than render time keeps the mutation below off a value
  // the React Compiler considers render-scoped.
  const store = useStore();
  const controls = useRef<OrbitControls>(null);
  const placed = useRef(false);
  const lastFit = useRef(0);
  const [extentX, extentY, extentZ] = model.extent;

  useEffect(() => {
    const camera = store.getState().camera as PerspectiveCamera;
    const orbit = controls.current;

    const radius = Math.hypot(extentX, extentY, extentZ) / 2;
    const fit = (radius / Math.sin((FOV / 2) * (Math.PI / 180))) * 1.05;
    const centre = new Vector3(0, extentY / 2, 0);

    camera.near = fit / 100;
    camera.far = fit * 10;
    camera.updateProjectionMatrix();

    if (orbit) {
      orbit.minDistance = radius * 0.8;
      orbit.maxDistance = fit * 3;
    }

    if (!placed.current) {
      camera.position.copy(centre).addScaledVector(DEFAULT_VIEW, fit);
      orbit?.target.copy(centre);
      placed.current = true;
    } else {
      // Offset from the *old* target carries the user's angle and how far they
      // have zoomed; rescaling it by the change in fit keeps the box the same
      // apparent size without touching the direction.
      const offset = camera.position
        .clone()
        .sub(orbit?.target ?? centre)
        .multiplyScalar(lastFit.current > 0 ? fit / lastFit.current : 1);
      orbit?.target.copy(centre);
      camera.position.copy(centre).add(offset);
    }

    lastFit.current = fit;
    orbit?.update();
  }, [store, extentX, extentY, extentZ]);

  // enableDamping only takes effect if update() runs every frame.
  useFrame(() => controls.current?.update());

  const { camera, gl } = store.getState();

  return (
    <orbitControls
      ref={controls}
      args={[camera, gl.domElement]}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
    />
  );
}
