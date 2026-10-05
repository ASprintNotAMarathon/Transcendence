// MOCK: a 3D take on GomokuBoard, same props, to see how the 3D graphics module could look.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { BOARD_SIZE, gomoku, winningLine } from '@transcendence/shared'
import type { Cell, GomokuMove, GomokuState } from '@transcendence/shared'

type GomokuBoard3DProps = {
  state: GomokuState
  onPlay?: (move: GomokuMove) => void
  preview?: boolean
}

const SPACING = 1
const HALF = ((BOARD_SIZE - 1) * SPACING) / 2
const MARGIN = 0.9
const BOARD_WIDTH = HALF * 2 + MARGIN * 2
const BOARD_THICKNESS = 0.7
const STONE_RADIUS = 0.46
const STONE_SQUASH = 0.42
const STONE_REST_Y = STONE_RADIUS * STONE_SQUASH
const STAR_POINTS = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]] as const

const toX = (col: number) => col * SPACING - HALF
const toZ = (row: number) => row * SPACING - HALF
const keyOf = (row: number, col: number) => row * BOARD_SIZE + col

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value === '' ? fallback : value
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Palette = {
  stones: [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
  dimmed: [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
  won: [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
  ghost: [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]
  glow: THREE.Color
  colors: [THREE.Color, THREE.Color]
}

function usePalette(): Palette {
  const palette = useMemo(() => {
    const colors: [THREE.Color, THREE.Color] = [
      new THREE.Color(cssColor('--color-stone-terracotta', '#C2663F')),
      new THREE.Color(cssColor('--color-stone-sage', '#B2C29C')),
    ]
    const glow = new THREE.Color(cssColor('--color-secondary', '#C9D6B5'))
    const stone = (color: THREE.Color, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.32,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
        ...extra,
      })
    const pair = (make: (color: THREE.Color) => THREE.MeshPhysicalMaterial) =>
      [make(colors[0]), make(colors[1])] as [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial]

    return {
      colors,
      glow,
      stones: pair((c) => stone(c)),
      dimmed: pair((c) => stone(c.clone().multiplyScalar(0.35), { clearcoat: 0.3 })),
      won: pair((c) => stone(c, { emissive: glow, emissiveIntensity: 0.8, toneMapped: false })),
      ghost: pair((c) => stone(c, { transparent: true, opacity: 0.45, depthWrite: false })),
    }
  }, [])

  useEffect(() => () => {
    for (const set of [palette.stones, palette.dimmed, palette.won, palette.ghost]) set.forEach((m) => m.dispose())
  }, [palette])

  return palette
}

const stoneGeometry = new THREE.SphereGeometry(STONE_RADIUS, 48, 24)

function Board() {
  return (
    <group>
      <mesh position={[0, -BOARD_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_WIDTH, BOARD_THICKNESS, BOARD_WIDTH]} />
        <meshStandardMaterial color="#b88a56" roughness={0.55} metalness={0.02} />
      </mesh>

      {Array.from({ length: BOARD_SIZE }, (_, i) => (
        <group key={i}>
          <mesh position={[0, 0.002, toZ(i)]}>
            <boxGeometry args={[HALF * 2, 0.004, 0.035]} />
            <meshStandardMaterial color="#3a2614" roughness={0.9} />
          </mesh>
          <mesh position={[toX(i), 0.002, 0]}>
            <boxGeometry args={[0.035, 0.004, HALF * 2]} />
            <meshStandardMaterial color="#3a2614" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {STAR_POINTS.map(([row, col]) => (
        <mesh key={`${row}-${col}`} position={[toX(col), 0.004, toZ(row)]}>
          <cylinderGeometry args={[0.09, 0.09, 0.006, 24]} />
          <meshStandardMaterial color="#3a2614" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Stone({
  row,
  col,
  material,
  drop,
  pulse,
}: {
  row: number
  col: number
  material: THREE.Material
  drop: boolean
  pulse: boolean
}) {
  const ref = useRef<THREE.Mesh>(null)
  const born = useRef<number | null>(null)
  const animate = drop && !prefersReducedMotion()

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (mesh === null) return
    if (pulse && mesh.material instanceof THREE.MeshPhysicalMaterial) {
      mesh.material.emissiveIntensity = prefersReducedMotion()
        ? 1.2
        : 0.9 + 0.6 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.6))
    }
    if (!animate) return
    if (born.current === null) born.current = clock.elapsedTime
    const t = Math.min((clock.elapsedTime - born.current) / 0.28, 1)
    mesh.position.y = STONE_REST_Y + (1 - t * t) * 2.2
  })

  return (
    <mesh
      ref={ref}
      geometry={stoneGeometry}
      material={material}
      position={[toX(col), animate ? STONE_REST_Y + 2.2 : STONE_REST_Y, toZ(row)]}
      scale={[1, STONE_SQUASH, 1]}
      castShadow
      receiveShadow
    />
  )
}

function Flash({ move, color }: { move: GomokuMove; color: THREE.Color }) {
  const ref = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.MeshBasicMaterial>(null)
  const born = useRef<number | null>(null)

  useFrame(({ clock }) => {
    if (ref.current === null || material.current === null) return
    if (born.current === null) born.current = clock.elapsedTime
    const t = Math.min((clock.elapsedTime - born.current) / 0.8, 1)
    const eased = 1 - (1 - t) * (1 - t)
    ref.current.scale.setScalar(1 + eased * 0.9)
    material.current.opacity = 0.9 * (1 - t)
  })

  if (prefersReducedMotion()) return null

  return (
    <mesh ref={ref} position={[toX(move.col), 0.02, toZ(move.row)]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[STONE_RADIUS * 0.95, STONE_RADIUS * 1.15, 48]} />
      <meshBasicMaterial ref={material} color={color} transparent opacity={0.9} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

function Scene({ state, onPlay, preview = true }: GomokuBoard3DProps) {
  const { board, moveCount, lastMove, turn } = state
  const palette = usePalette()
  const [hover, setHover] = useState<GomokuMove | null>(null)

  const won = useMemo(() => new Set(winningLine(state).map((m) => keyOf(m.row, m.col))), [state])
  const legal = useMemo(
    () => new Set(onPlay === undefined ? [] : gomoku.legalMoves(state).map((m) => keyOf(m.row, m.col))),
    [onPlay, state],
  )

  const showGhost = hover !== null && preview && legal.has(keyOf(hover.row, hover.col))

  useEffect(() => {
    document.body.style.cursor = showGhost ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [showGhost])

  const pointAt = (event: ThreeEvent<PointerEvent | MouseEvent>): GomokuMove | null => {
    const col = Math.round((event.point.x + HALF) / SPACING)
    const row = Math.round((event.point.z + HALF) / SPACING)
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null
    const dx = event.point.x - toX(col)
    const dz = event.point.z - toZ(row)
    return Math.hypot(dx, dz) <= STONE_RADIUS ? { row, col } : null
  }

  const lastBy: Cell = lastMove === null ? null : board[lastMove.row][lastMove.col]

  return (
    <>
      <color attach="background" args={['#0A0B0D']} />
      <fog attach="fog" args={['#0A0B0D', 22, 42]} />

      <ambientLight intensity={0.25} />
      <directionalLight
        position={[6, 14, 8]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-bias={-0.0004}
      />
      <spotLight position={[-10, 9, -6]} angle={0.5} penumbra={1} intensity={60} color="#ffb98a" />

      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 6, -9]} scale={[14, 4, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffd9b8" position={[-9, 4, 2]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="ring" intensity={2} color="#C9D6B5" position={[8, 5, 6]} scale={3} />
      </Environment>

      <mesh position={[0, -BOARD_THICKNESS - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial color="#15171c" roughness={0.95} />
      </mesh>
      <ContactShadows position={[0, -BOARD_THICKNESS, 0]} scale={BOARD_WIDTH * 1.6} blur={2.4} opacity={0.7} far={2} />

      <Board />

      {board.flatMap((cells, row) =>
        cells.map((cell, col) => {
          if (cell === null) return null
          const k = keyOf(row, col)
          const material = won.size === 0 ? palette.stones[cell] : won.has(k) ? palette.won[cell] : palette.dimmed[cell]
          const isLast = lastMove !== null && lastMove.row === row && lastMove.col === col
          return <Stone key={k} row={row} col={col} material={material} drop={isLast} pulse={won.has(k)} />
        }),
      )}

      {lastMove !== null && lastBy !== null && (
        <Flash key={`flash-${moveCount}`} move={lastMove} color={palette.colors[lastBy]} />
      )}

      {showGhost && hover !== null && (
        <mesh
          geometry={stoneGeometry}
          material={palette.ghost[turn]}
          position={[toX(hover.col), STONE_REST_Y, toZ(hover.row)]}
          scale={[1, STONE_SQUASH, 1]}
        />
      )}

      {onPlay !== undefined && (
        <mesh
          position={[0, 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={(e) => setHover(pointAt(e))}
          onPointerOut={() => setHover(null)}
          onClick={(e) => {
            if (e.delta > 4) return
            const move = pointAt(e)
            if (move !== null) onPlay(move)
          }}
        >
          <planeGeometry args={[BOARD_WIDTH, BOARD_WIDTH]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}

      <OrbitControls
        target={[0, 0, 0]}
        enablePan={false}
        minDistance={14}
        maxDistance={38}
        minPolarAngle={0.15}
        maxPolarAngle={1.2}
        enableDamping
      />

      <EffectComposer multisampling={4}>
        <N8AO halfRes aoRadius={0.6} intensity={2.2} distanceFalloff={0.6} />
        <Bloom mipmapBlur luminanceThreshold={1} intensity={0.9} />
        <Vignette eskil={false} offset={0.25} darkness={0.7} />
      </EffectComposer>
    </>
  )
}

function GomokuBoard3D(props: GomokuBoard3DProps) {
  return (
    <div
      className="aspect-square w-full max-w-[32rem] overflow-hidden rounded-box"
      role="img"
      aria-label={`Gomoku board in 3D, ${props.state.moveCount} stones played`}
    >
      <Canvas shadows="soft" dpr={[1, 2]} camera={{ position: [0, 20.5, 16], fov: 40 }}>
        <Scene {...props} />
      </Canvas>
    </div>
  )
}

export default GomokuBoard3D
