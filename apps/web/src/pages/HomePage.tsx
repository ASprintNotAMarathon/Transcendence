import LiveMatches from '../match/LiveMatches'

function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <h1 className="font-barrio text-3xl text-(--color-base-content)">Lobby</h1>
      <LiveMatches />
    </div>
  )
}

export default HomePage
