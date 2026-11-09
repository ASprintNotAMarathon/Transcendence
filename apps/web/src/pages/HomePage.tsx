import FriendsStrip from '../components/FriendsStrip'
import LiveMatches from '../match/LiveMatches'
import PlayCard from '../components/PlayCard'

function HomePage() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* On a phone the friends come first, on a wide screen they sit on the right. */}
      <aside className="order-first lg:order-last">
        <FriendsStrip />
      </aside>

      <div className="flex min-w-0 flex-col gap-8">
        <h1 className="sr-only">Lobby</h1>
        <PlayCard searching={false} onFind={() => {}} onCancel={() => {}} />
        <LiveMatches />
      </div>
    </div>
  )
}

export default HomePage
