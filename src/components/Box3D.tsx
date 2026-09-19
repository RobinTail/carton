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

const KRAFT = { outer: "#cda271", inner: "#a87c4c" } as const;
const FOV = 40;

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
  return (
    <mesh position={slab.position} rotation={slab.rotation}>
      <boxGeometry args={slab.size} />
      <meshStandardMaterial
        color={KRAFT[slab.tone]}
        roughness={0.85}
        metalness={0}
      />
    </mesh>
  );
}

/**
 * Frames the camera on the model and drives the orbit controls. Refits whenever
 * the box changes size, so a flat tray and a tall carton both fill the view.
 */
function Frame({ model }: { model: BoxModel }) {
  // The camera and canvas are fixed for the Canvas's lifetime, so reading them
  // off the store is a stable, non-reactive read — and taking the camera at
  // effect time rather than render time keeps the mutation below off a value
  // the React Compiler considers render-scoped.
  const store = useStore();
  const controls = useRef<OrbitControls>(null);
  const [extentX, extentY, extentZ] = model.extent;

  useEffect(() => {
    const camera = store.getState().camera as PerspectiveCamera;
    const radius = Math.hypot(extentX, extentY, extentZ) / 2;
    const distance = (radius / Math.sin((FOV / 2) * (Math.PI / 180))) * 1.05;
    const centre = new Vector3(0, extentY / 2, 0);

    camera.position
      .copy(centre)
      .addScaledVector(new Vector3(0.75, 0.55, 1).normalize(), distance);
    camera.near = distance / 100;
    camera.far = distance * 10;
    camera.updateProjectionMatrix();

    const orbit = controls.current;
    if (orbit) {
      orbit.target.copy(centre);
      orbit.minDistance = radius * 0.8;
      orbit.maxDistance = distance * 3;
      orbit.update();
    }
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
      // Stop short of the poles so the box never flips through its own floor.
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI / 2 + 0.35}
    />
  );
}
