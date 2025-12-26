import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Center } from '@react-three/drei';
import type { ProblemGeometry, OverlayVisibility, CameraFrame } from '../lib/types';
import { GLBModel } from './GLBModel';
import { ProblemOverlays } from './ProblemOverlays';

interface ModelViewerProps {
  glbUrl: string | null;
  problemGeometry: ProblemGeometry | null;
  overlayVisibility: OverlayVisibility;
  cameraFrame?: CameraFrame;
}

/**
 * Main 3D viewer wrapper using React Three Fiber.
 * Displays a GLB model with optional problem geometry overlays.
 */
export function ModelViewer({
  glbUrl,
  problemGeometry,
  overlayVisibility,
  cameraFrame,
}: ModelViewerProps) {
  // Compute camera props from frame if provided
  const cameraProps = useMemo(() => {
    if (cameraFrame) {
      return {
        position: cameraFrame.position as [number, number, number],
        near: cameraFrame.near,
        far: cameraFrame.far,
        fov: 50,
      };
    }
    // Default camera for when no frame is provided
    return {
      position: [2, 2, 2] as [number, number, number],
      near: 0.01,
      far: 1000,
      fov: 50,
    };
  }, [cameraFrame]);

  const controlsTarget = useMemo(() => {
    if (cameraFrame) {
      return cameraFrame.target as [number, number, number];
    }
    return [0, 0, 0] as [number, number, number];
  }, [cameraFrame]);

  return (
    <div className="w-full h-full relative bg-neutral-900">
      {/* Loading/empty state overlay */}
      {!glbUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
          <span>No model loaded</span>
        </div>
      )}

      <Canvas
        camera={cameraProps}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#171717' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Environment preset="studio" background={false} />

        {/* Camera controls */}
        <OrbitControls
          target={controlsTarget}
          enableDamping
          dampingFactor={0.1}
          minDistance={0.1}
          maxDistance={100}
        />

        {/* Model with loading suspense */}
        {glbUrl && (
          <Suspense fallback={<LoadingIndicator />}>
            <Center>
              <GLBModel url={glbUrl} />
            </Center>
          </Suspense>
        )}

        {/* Problem geometry overlays */}
        {problemGeometry && (
          <ProblemOverlays
            problemGeometry={problemGeometry}
            visibility={overlayVisibility}
          />
        )}
      </Canvas>
    </div>
  );
}

/**
 * Simple loading indicator shown while GLB is loading.
 */
function LoadingIndicator() {
  return (
    <mesh>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshStandardMaterial color="#666666" wireframe />
    </mesh>
  );
}

/**
 * Default overlay visibility settings.
 */
export const defaultOverlayVisibility: OverlayVisibility = {
  wireframe: false,
  boundaryEdges: true,
  nonManifoldEdges: true,
  pinchPoints: true,
  selfIntersections: true,
  tJunctions: true,
};
