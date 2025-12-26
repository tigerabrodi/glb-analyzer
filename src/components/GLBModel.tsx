import { useGLTF } from '@react-three/drei';

interface GLBModelProps {
  url: string;
}

/**
 * Loads and displays a GLB model using drei's useGLTF hook.
 * Must be used inside a Canvas component.
 */
export function GLBModel({ url }: GLBModelProps) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

/**
 * Preload a GLB model for faster loading.
 * Call this outside of React components when you know a URL ahead of time.
 */
export function preloadGLBModel(url: string) {
  useGLTF.preload(url);
}
