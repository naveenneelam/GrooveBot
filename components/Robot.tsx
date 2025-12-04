import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils, Color, Euler, Vector3 } from 'three';
import { AudioFeatures, MotionMapping, DancePose, DanceSequence, DEFAULT_POSE } from '../types';

interface RobotProps {
  features: AudioFeatures;
  mapping: MotionMapping;
  editorPose?: DancePose | null;
  activeSequence?: DanceSequence | null;
  damping?: number;
}

// Procedural Geometry Constants
const BODY_WIDTH = 0.8;
const BODY_HEIGHT = 1.2;
const HEAD_SIZE = 0.5;
const LIMB_WIDTH = 0.2;
const LIMB_LENGTH = 0.9;

// --- Biomechanical Joint Limits (Radians) ---
// Min/Max angles for each axis [x, y, z]
const JOINT_LIMITS: Record<string, { x: [number, number], y: [number, number], z: [number, number] }> = {
  spine: { x: [-0.3, 0.4], y: [-0.8, 0.8], z: [-0.3, 0.3] }, // Bend, Twist, Sway
  head:  { x: [-0.6, 0.6], y: [-1.2, 1.2], z: [-0.5, 0.5] }, // Nod, Turn, Tilt
  
  // Arms (Shoulders)
  // X: Raise/Lower, Y: Forward/Back, Z: Abduction
  lArm:  { x: [-1.0, 3.0], y: [-1.5, 1.0], z: [-0.5, 2.5] }, 
  rArm:  { x: [-1.0, 3.0], y: [-1.0, 1.5], z: [-2.5, 0.5] },
  
  // Forearms (Elbows) - Hinge primarily on Z
  lForeArm: { x: [0, 0], y: [0, 0], z: [0, 2.6] }, 
  rForeArm: { x: [0, 0], y: [0, 0], z: [-2.6, 0] },

  // Legs (Hips)
  lLeg:  { x: [-1.2, 0.8], y: [-0.5, 0.5], z: [-0.5, 0.5] },
  rLeg:  { x: [-1.2, 0.8], y: [-0.5, 0.5], z: [-0.5, 0.5] },

  // Shins (Knees) - Hinge on X, bend backwards only
  lShin: { x: [0, 2.0], y: [0, 0], z: [0, 0] },
  rShin: { x: [0, 2.0], y: [0, 0], z: [0, 0] },
};

// --- Physics State Types ---
type Vector3Tuple = [number, number, number];
interface JointState {
  rotation: Vector3Tuple;
  velocity: Vector3Tuple;
}

const Robot: React.FC<RobotProps> = ({ features, mapping, editorPose, activeSequence, damping: userDamping = 6 }) => {
  const hipsRef = useRef<Group>(null);
  const spineRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftForeArmRef = useRef<Group>(null);
  const rightForeArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const leftShinRef = useRef<Group>(null);
  const rightShinRef = useRef<Group>(null);
  const rootRef = useRef<Group>(null);

  const timeRef = useRef(0);
  
  // Physics Simulation State (position & velocity for every joint)
  // We use this to integrate forces before applying to ThreeJS objects
  const physicsState = useRef<Record<string, JointState>>({
    hips:     { rotation: [0,0,0], velocity: [0,0,0] }, // Using rotation vector for position Y stored in x
    spine:    { rotation: [0,0,0], velocity: [0,0,0] },
    head:     { rotation: [0,0,0], velocity: [0,0,0] },
    lArm:     { rotation: [0,0,0], velocity: [0,0,0] },
    rArm:     { rotation: [0,0,0], velocity: [0,0,0] },
    lForeArm: { rotation: [0,0,0], velocity: [0,0,0] },
    rForeArm: { rotation: [0,0,0], velocity: [0,0,0] },
    lLeg:     { rotation: [0,0,0], velocity: [0,0,0] },
    rLeg:     { rotation: [0,0,0], velocity: [0,0,0] },
    lShin:    { rotation: [0,0,0], velocity: [0,0,0] },
    rShin:    { rotation: [0,0,0], velocity: [0,0,0] },
  });

  // Default Procedural Moves
  const defaultMoves: DancePose[] = useMemo(() => [
    { 
      head: [0, 0, 0], spine: [0.1, 0, 0], 
      lArm: [0, 0, 0.3], rArm: [0, 0, -0.3],
      lLeg: [0, 0, 0], rLeg: [0, 0, 0]
    },
    { 
      head: [-0.2, 0, 0], spine: [-0.1, 0, 0], 
      lArm: [0, 0, 2.5], rArm: [0, 0, -2.5],
      lLeg: [-0.2, 0, 0], rLeg: [-0.2, 0, 0]
    },
    { 
      head: [0, 0, 0], spine: [0, 0, 0], 
      lArm: [0, 0, 1.5], rArm: [0, 0, -1.5],
      lLeg: [0, 0, 0.2], rLeg: [0, 0, -0.2]
    },
    { 
      head: [0.1, 0, 0], spine: [0.2, 0.1, 0], 
      lArm: [0.5, 0.5, 0.5], rArm: [-0.5, 0.5, -0.5],
      lLeg: [-0.4, 0, 0], rLeg: [0.4, 0, 0]
    },
  ], []);

  const activeMoves = useMemo(() => {
    if (activeSequence && activeSequence.poses.length > 0) {
      return activeSequence.poses;
    }
    return defaultMoves;
  }, [activeSequence, defaultMoves]);

  const moveIndex = useRef(0);

  // Helper to get feature value safely
  const getFeature = (key: keyof AudioFeatures): number => {
    const val = features[key];
    return typeof val === 'number' ? val : 0;
  };

  // --- Physics Solver Function ---
  // Integrates a spring-damper system and clamps to limits
  const solveJoint = (
    jointName: string, 
    targetRot: Vector3Tuple, 
    dt: number, 
    stiffness: number, 
    damping: number,
    noise: Vector3Tuple = [0,0,0]
  ) => {
    const state = physicsState.current[jointName];
    if (!state) return;
    
    const limits = JOINT_LIMITS[jointName] || { x: [-10,10], y: [-10,10], z: [-10,10] };
    
    // Process each axis (X, Y, Z)
    for (let i = 0; i < 3; i++) {
      const axis = i === 0 ? 'x' : i === 1 ? 'y' : 'z';
      const min = limits[axis as 'x'|'y'|'z'][0];
      const max = limits[axis as 'x'|'y'|'z'][1];
      
      const target = targetRot[i] + noise[i];
      const current = state.rotation[i];
      const vel = state.velocity[i];
      
      // Spring Force: F = -k * (x - target)
      // Damping: F_d = -d * v
      const acceleration = (target - current) * stiffness - (vel * damping);
      
      // Verlet Integration
      let newVel = vel + acceleration * dt;
      let newPos = current + newVel * dt;
      
      // Constraint Solving (Clamping)
      if (newPos < min) {
        newPos = min;
        newVel = 0; // Inelastic collision with limit
      } else if (newPos > max) {
        newPos = max;
        newVel = 0;
      }
      
      state.rotation[i] = newPos;
      state.velocity[i] = newVel;
    }
  };

  useFrame((state, delta) => {
    timeRef.current += delta;
    
    // Prevent explosion on large delta (tab switching)
    const dt = Math.min(delta, 0.1);

    // --- 1. Mode Selection ---
    let targetPose: DancePose;
    let isEditing = !!editorPose;

    if (isEditing && editorPose) {
      targetPose = editorPose;
    } else {
      if (features.isBeat) {
        let nextMove = (moveIndex.current + 1) % activeMoves.length;
        if (!activeSequence) {
           if (getFeature('energy') > 0.6 && Math.random() > 0.5) nextMove = 1;
           else nextMove = Math.floor(Math.random() * activeMoves.length);
        }
        moveIndex.current = nextMove;
      }
      targetPose = activeMoves[moveIndex.current] || DEFAULT_POSE;
    }

    // Physics Parameters (Stiffer when editing, looser when dancing)
    const stiffness = isEditing ? 150 : 40 + getFeature('energy') * 20;
    // Use user-provided damping unless in editor mode where we want stability
    const damping = isEditing ? 20 : userDamping;

    // --- 2. Calculate Procedural Targets & Noise ---
    const bounceVal = isEditing ? 0 : getFeature(mapping.bounce);
    const twistVal = isEditing ? 0 : getFeature(mapping.spineTwist);
    const nodVal = isEditing ? 0 : getFeature(mapping.headNod);
    const wiggleVal = isEditing ? 0 : getFeature(mapping.armWiggle);
    const bass = isEditing ? 0 : getFeature('bass');

    // Pitch logic
    const pitchHz = features.pitch;
    const hasPitch = pitchHz > 50; 
    const pitchTilt = hasPitch 
      ? MathUtils.mapLinear(MathUtils.clamp(pitchHz, 100, 800), 100, 800, -0.3, 0.3)
      : 0;

    // --- 3. Run Physics Solver for All Joints ---

    // HIPS (Position Y) - Treated as a 1D joint in our solver
    solveJoint('hips', [bounceVal * 0.5, 0, 0], dt, stiffness * 0.5, damping, 
      [Math.sin(timeRef.current * 10) * 0.1, 0, 0]
    );

    // SPINE
    solveJoint('spine', targetPose.spine, dt, stiffness, damping, [
      Math.sin(timeRef.current * 5) * twistVal * 0.2, 
      Math.cos(timeRef.current * 3) * twistVal * 0.3, 
      0
    ]);

    // HEAD
    solveJoint('head', targetPose.head, dt, stiffness, damping, [
      nodVal * 0.5, 
      Math.sin(timeRef.current * 8) * nodVal * 0.1, 
      isEditing ? 0 : pitchTilt
    ]);

    // ARMS (Shoulders)
    const armWiggle = Math.sin(timeRef.current * 12) * wiggleVal;
    solveJoint('lArm', targetPose.lArm, dt, stiffness, damping, [0, 0, armWiggle * 0.3]);
    solveJoint('rArm', targetPose.rArm, dt, stiffness, damping, [0, 0, -armWiggle * 0.3]);

    // FOREARMS (Elbows) - Procedurally driven by parent arm motion + wiggle
    // If dancing, elbows react to energy. If editing, zero.
    const lForeArmTarget: Vector3Tuple = isEditing ? [0,0,0] : [0, 0, Math.abs(Math.sin(timeRef.current)) * 1.5 + wiggleVal];
    const rForeArmTarget: Vector3Tuple = isEditing ? [0,0,0] : [0, 0, -(Math.abs(Math.sin(timeRef.current)) * 1.5 + wiggleVal)];
    solveJoint('lForeArm', lForeArmTarget, dt, stiffness * 0.8, damping);
    solveJoint('rForeArm', rForeArmTarget, dt, stiffness * 0.8, damping);

    // LEGS (Hips)
    solveJoint('lLeg', targetPose.lLeg, dt, stiffness, damping, [Math.sin(timeRef.current * 10) * bass * 0.2, 0, 0]);
    solveJoint('rLeg', targetPose.rLeg, dt, stiffness, damping, [-Math.sin(timeRef.current * 10) * bass * 0.2, 0, 0]);

    // SHINS (Knees) - Procedural bend on beat
    const kneeBend = isEditing ? 0 : (features.isBeat ? 1.0 : 0.1);
    solveJoint('lShin', [kneeBend, 0, 0], dt, stiffness * 0.5, damping * 2);
    solveJoint('rShin', [kneeBend, 0, 0], dt, stiffness * 0.5, damping * 2);


    // --- 4. Apply Solved Physics State to THREE Objects ---
    if (hipsRef.current) hipsRef.current.position.y = physicsState.current.hips.rotation[0]; // Mapping X rot to Y pos
    
    if (spineRef.current) spineRef.current.rotation.set(...physicsState.current.spine.rotation);
    if (headRef.current) headRef.current.rotation.set(...physicsState.current.head.rotation);
    
    if (leftArmRef.current) leftArmRef.current.rotation.set(...physicsState.current.lArm.rotation);
    if (rightArmRef.current) rightArmRef.current.rotation.set(...physicsState.current.rArm.rotation);
    
    if (leftForeArmRef.current) leftForeArmRef.current.rotation.set(...physicsState.current.lForeArm.rotation);
    if (rightForeArmRef.current) rightForeArmRef.current.rotation.set(...physicsState.current.rForeArm.rotation);
    
    if (leftLegRef.current) leftLegRef.current.rotation.set(...physicsState.current.lLeg.rotation);
    if (rightLegRef.current) rightLegRef.current.rotation.set(...physicsState.current.rLeg.rotation);

    if (leftShinRef.current) leftShinRef.current.rotation.set(...physicsState.current.lShin.rotation);
    if (rightShinRef.current) rightShinRef.current.rotation.set(...physicsState.current.rShin.rotation);

    // Global Scale Pulse (Direct, not physics)
    if (rootRef.current) {
      const scaleVal = isEditing ? 0 : getFeature(mapping.scale);
      const s = 1 + scaleVal * 0.2;
      rootRef.current.scale.setScalar(MathUtils.lerp(rootRef.current.scale.x, s, 0.1));
    }
  });

  // Dynamic Color
  const colorVal = getFeature(mapping.colorShift);
  const color = new Color().setHSL(0.6 + colorVal * 0.4, 0.8, 0.5);

  const pitchColor = useMemo(() => {
    const hue = MathUtils.mapLinear(MathUtils.clamp(features.pitch, 100, 1000), 100, 1000, 0.6, 0.05);
    return new Color().setHSL(hue, 1, 0.6);
  }, [features.pitch]);

  return (
    <group ref={rootRef} position={[0, -1, 0]}>
      <group ref={hipsRef}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[BODY_WIDTH, 0.3, 0.4]} />
          <meshStandardMaterial color={color} roughness={0.2} metalness={0.8} />
        </mesh>

        {/* SPINE */}
        <group ref={spineRef} position={[0, 0.15, 0]}>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[BODY_WIDTH * 0.9, BODY_HEIGHT, 0.5]} />
            <meshStandardMaterial color="#333" roughness={0.4} />
            <mesh position={[0, 0, 0.26]}>
               <circleGeometry args={[0.15, 32]} />
               <meshBasicMaterial color={features.isBeat ? "white" : color} />
            </mesh>
          </mesh>

          {/* HEAD */}
          <group ref={headRef} position={[0, 1.25, 0]}>
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[HEAD_SIZE, HEAD_SIZE * 1.2, HEAD_SIZE]} />
              <meshStandardMaterial 
                color={color} 
                roughness={0.2} 
                emissive={features.pitch > 50 ? pitchColor : "black"}
                emissiveIntensity={features.pitch > 50 ? 0.8 : 0}
              />
              <mesh position={[0.15, 0.1, 0.26]}>
                 <boxGeometry args={[0.1, 0.05, 0.05]} />
                 <meshBasicMaterial color="cyan" />
              </mesh>
               <mesh position={[-0.15, 0.1, 0.26]}>
                 <boxGeometry args={[0.1, 0.05, 0.05]} />
                 <meshBasicMaterial color="cyan" />
              </mesh>
            </mesh>
          </group>

          {/* ARMS */}
          <group ref={leftArmRef} position={[BODY_WIDTH * 0.6, 1.1, 0]}>
            <mesh position={[0, -LIMB_LENGTH/2, 0]}>
              <boxGeometry args={[LIMB_WIDTH, LIMB_LENGTH, LIMB_WIDTH]} />
              <meshStandardMaterial color="#444" />
            </mesh>
            <group ref={leftForeArmRef} position={[0, -LIMB_LENGTH, 0]}>
               <mesh position={[0, -LIMB_LENGTH/2, 0]}>
                 <boxGeometry args={[LIMB_WIDTH*0.8, LIMB_LENGTH, LIMB_WIDTH*0.8]} />
                 <meshStandardMaterial color={color} />
               </mesh>
            </group>
          </group>

          <group ref={rightArmRef} position={[-BODY_WIDTH * 0.6, 1.1, 0]}>
             <mesh position={[0, -LIMB_LENGTH/2, 0]}>
              <boxGeometry args={[LIMB_WIDTH, LIMB_LENGTH, LIMB_WIDTH]} />
              <meshStandardMaterial color="#444" />
            </mesh>
             <group ref={rightForeArmRef} position={[0, -LIMB_LENGTH, 0]}>
               <mesh position={[0, -LIMB_LENGTH/2, 0]}>
                 <boxGeometry args={[LIMB_WIDTH*0.8, LIMB_LENGTH, LIMB_WIDTH*0.8]} />
                 <meshStandardMaterial color={color} />
               </mesh>
            </group>
          </group>
        </group>

        {/* LEGS */}
        <group ref={leftLegRef} position={[0.25, -0.15, 0]}>
          <mesh position={[0, -LIMB_LENGTH/2, 0]}>
            <boxGeometry args={[LIMB_WIDTH, LIMB_LENGTH, LIMB_WIDTH]} />
            <meshStandardMaterial color="#222" />
          </mesh>
           <group ref={leftShinRef} position={[0, -LIMB_LENGTH, 0]}>
              <mesh position={[0, -LIMB_LENGTH/2, 0]}>
                <boxGeometry args={[LIMB_WIDTH*0.8, LIMB_LENGTH, LIMB_WIDTH*0.8]} />
                <meshStandardMaterial color="#222" />
              </mesh>
           </group>
        </group>

        <group ref={rightLegRef} position={[-0.25, -0.15, 0]}>
          <mesh position={[0, -LIMB_LENGTH/2, 0]}>
             <boxGeometry args={[LIMB_WIDTH, LIMB_LENGTH, LIMB_WIDTH]} />
             <meshStandardMaterial color="#222" />
          </mesh>
          <group ref={rightShinRef} position={[0, -LIMB_LENGTH, 0]}>
              <mesh position={[0, -LIMB_LENGTH/2, 0]}>
                <boxGeometry args={[LIMB_WIDTH*0.8, LIMB_LENGTH, LIMB_WIDTH*0.8]} />
                <meshStandardMaterial color="#222" />
              </mesh>
           </group>
        </group>

      </group>
    </group>
  );
};

export default Robot;