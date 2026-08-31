import { Link } from 'react-router'

/**
 * A small hero illustration of a Gomoku board: stones place themselves one
 * by one, ending on a line of five. The one animated moment on the page,
 * everything else stays still.
 */
function BoardIllustration() {
  const spacing = 34
  const lines = 7 // 7 grid lines -> 6x6 cells, enough to read at a glance
  const size = spacing * (lines - 1)

  const gridLines = Array.from({ length: lines }, (_, i) => i * spacing)

  // Stones in placement order, so the animation reads like a game being
  // played rather than a diagram fading in.
  const stones = [
    { col: 1, row: 1, color: 'black' },
    { col: 3, row: 3, color: 'white' },
    { col: 4, row: 1, color: 'black' },
    { col: 2, row: 3, color: 'white' },
    { col: 5, row: 5, color: 'black' },
    { col: 4, row: 3, color: 'white' },
    { col: 2, row: 5, color: 'black' },
    { col: 1, row: 3, color: 'white' },
    { col: 3, row: 5, color: 'black' },
    { col: 5, row: 3, color: 'white', winning: true },
  ] as const

  const winStart = stones.find((s) => s.row === 3 && s.col === 1)!
  const winEnd = stones.find((s) => s.row === 3 && s.col === 5)!

  return (
    <svg
      viewBox={`-20 -20 ${size + 40} ${size + 40}`}
      width={size + 40}
      height={size + 40}
      role="img"
      aria-label="Gomoku board, five white stones lining up to win"
      className="overflow-visible"
    >
      <defs>
        <radialGradient id="board-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#D9A441" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#D9A441" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={size / 2} cy={size / 2} r={size / 1.4} fill="url(#board-glow)" />

      {gridLines.map((pos) => (
        <line key={`h-${pos}`} x1={0} y1={pos} x2={size} y2={pos} stroke="#4A4E5A" strokeWidth={1} />
      ))}
      {gridLines.map((pos) => (
        <line key={`v-${pos}`} x1={pos} y1={0} x2={pos} y2={size} stroke="#4A4E5A" strokeWidth={1} />
      ))}

      <line
        x1={winStart.col * spacing}
        y1={winStart.row * spacing}
        x2={winEnd.col * spacing}
        y2={winEnd.row * spacing}
        stroke="#D9A441"
        strokeWidth={3}
        strokeLinecap="round"
        className="stone-win-line"
      />

      {stones.map((stone, i) => (
        <circle
          key={`${stone.col}-${stone.row}`}
          cx={stone.col * spacing}
          cy={stone.row * spacing}
          r={12}
          fill={stone.color === 'white' ? '#ECE7DE' : '#0F1013'}
          stroke={stone.color === 'black' ? '#4A4E5A' : 'none'}
          strokeWidth={1}
          className="stone-pop"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </svg>
  )
}

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[#14161B] px-6 py-16 text-center">
      <BoardIllustration />

      <div className="flex max-w-md flex-col items-center gap-4">
        <h1 className="font-display text-4xl font-semibold text-[#ECE7DE] sm:text-5xl">
          ft_transcendence
        </h1>
        <p className="text-balance text-[#9A9CA5]">
          Five in a row, live. Open a match, take turns, first to line up five
          stones wins.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link
          to="/login"
          className="rounded-md bg-[#D9A441] px-6 py-3 font-medium text-[#14161B] transition-transform duration-150 hover:scale-105 hover:bg-[#C6923A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9A441]"
        >
          Start playing
        </Link>
        <Link
          to="/register"
          className="px-6 py-3 text-sm text-[#9A9CA5] underline-offset-4 hover:text-[#ECE7DE] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9A441]"
        >
          New here? Create an account
        </Link>
      </div>
    </div>
  )
}

export default LandingPage
