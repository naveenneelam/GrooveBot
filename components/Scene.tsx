import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Stars, Text } from '@react-three/drei';
import Robot from './Robot';
import { AudioFeatures, MotionMapping, DEFAULT_MAPPING, DancePose, DanceSequence } from '../types';
import * as THREE from 'three';

interface SceneProps {
  features: AudioFeatures;
  mapping?: MotionMapping;
  editorPose?: DancePose | null;
  activeSequence?: DanceSequence | null;
  damping?: number;
}

const ReactiveFloor = ({ features }: { features: AudioFeatures }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (meshRef.current) {
      const targetEmissive = features.isBeat ? 0.5 : 0.1;
      const currentEmissive = (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity;
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = THREE.MathUtils.lerp(currentEmissive, targetEmissive, 0.1);
      meshRef.current.rotation.z += 0.001;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <circleGeometry args={[10, 64]} />
      <meshStandardMaterial 
        color="#1a1a1a" 
        emissive="#4f46e5"
        emissiveIntensity={0.1}
        roughness={0.1} 
        metalness={0.5} 
        wireframe={true}
      />
    </mesh>
  );
};

const Scene: React.FC<SceneProps> = ({ 
  features, 
  mapping = DEFAULT_MAPPING,
  editorPose,
  activeSequence,
  damping = 6
}) => {
  return (
    <Canvas
      camera={{ position: [0, 2, 6], fov: 50 }}
      shadows
      dpr={[1, 2]}
    >
      <color attach="background" args={['#050505']} />
      <fog attach="fog" args={['#050505', 5, 20]} />
      
      <ambientLight intensity={0.5} />
      <spotLight 
        position={[5, 5, 5]} 
        angle={0.15} 
        penumbra={1} 
        intensity={100 * (1 + features.energy)} 
        castShadow 
        color="cyan"
      />
      <pointLight position={[-5, 5, -5]} intensity={50} color="purple" />
      
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      {/* Floating Pitch Visualization */}
      {features.pitch > 50 && (
        <Text
          position={[1.5, 2, 0]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000"
        >
          {features.pitch.toFixed(0)} Hz
        </Text>
      )}

      <Robot 
        features={features} 
        mapping={mapping} 
        editorPose={editorPose}
        activeSequence={activeSequence}
        damping={damping}
      />
      <ReactiveFloor features={features} />
      
      <ContactShadows resolution={1024} scale={20} blur={2} opacity={0.5} far={10} color="#000000" />
      
      <OrbitControls minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
      <Environment preset="city" />
    </Canvas>
  );
};

export default Scene;