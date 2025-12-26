import { useGLTF } from '@react-three/drei'
import { useEffect } from 'react'
import * as THREE from 'three'

interface GLBModelProps {
  url: string
  wireframe?: boolean
}

/**
 * Loads and displays a GLB model using drei's useGLTF hook.
 * Must be used inside a Canvas component.
 */
export function GLBModel({ url, wireframe = false }: GLBModelProps) {
  const { scene } = useGLTF(url)

  // Toggle wireframe mode on all materials
  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material]

        materials.forEach((mat) => {
          if (mat instanceof THREE.Material && 'wireframe' in mat) {
            ;(mat as THREE.MeshStandardMaterial).wireframe = wireframe
          }
        })
      }
    })
  }, [scene, wireframe])

  return <primitive object={scene} />
}
