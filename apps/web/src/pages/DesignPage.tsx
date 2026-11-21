import type { ReactNode } from 'react'
import Avatar from '../components/Avatar'
import BackLink from '../components/BackLink'
import Card from '../components/Card'
import EmptyState from '../components/states/EmptyState'
import ErrorState from '../components/states/ErrorState'
import ErrorText from '../components/ErrorText'
import FormField from '../components/FormField'
import Icon, { type IconName } from '../components/Icon'
import LoadingState from '../components/states/LoadingState'
import PlayerLink from '../components/PlayerLink'
import PrimaryButton from '../components/PrimaryButton'
import PrimaryLink from '../components/PrimaryLink'
import QuietButton from '../components/QuietButton'
import SectionHeading from '../components/SectionHeading'

/*
  DesignPage. Everything our interface is built from, on one screen: the
  palette, the type scale, the icons and the components.

  It imports the real components, not copies of them. So if a component
  changes, this page changes with it, and it cannot drift from the app.

  Not linked from anywhere: open it at /design.
*/

const COLOURS = [
  ['primary', 'buttons and the glow behind every page'],
  ['secondary', 'the sage of the chat button'],
  ['stone-terracotta', 'the first player'],
  ['stone-sage', 'the second player'],
  ['error', 'error text, 4.5:1 contrast where primary only reaches 3.3:1'],
  ['base-content', 'all text'],
  ['base-100', 'cards and input fields'],
  ['base-200', 'the page'],
  ['board-line', 'borders of cards and fields'],
  ['board-surface', 'the board itself'],
]

const ICONS: IconName[] = ['back', 'close', 'send', 'addFriend', 'message']

// One labelled example, so every block on this page looks the same.
function Sample({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-(--color-board-line) p-4">
      <p className="text-xs uppercase tracking-widest text-muted">{name}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

function DesignPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-10">
      <div className="flex flex-col gap-3">
        <BackLink to="/">Back to start</BackLink>
        <h1 className="font-barrio text-4xl text-(--color-primary-content)">Design system</h1>
        <p className="text-muted">
          Everything the interface is built from. The palette started from the cover of a Chinese
          gomoku book: black, a pale board and one loud red. We kept that contrast, a dark page with
          a calm board and red saved for the thing you should look at. The cover itself is not shown
          here, it is someone else's copyrighted artwork.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading>Colour palette</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLOURS.map(([name, what]) => (
            <div key={name} className="flex items-center gap-3">
              <span
                className="size-10 shrink-0 rounded-xl border border-(--color-board-line)"
                style={{ background: `var(--color-${name})` }}
              />
              <span className="min-w-0">
                <span className="block text-sm">{name}</span>
                <span className="block text-sm text-muted">{what}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">
          Every colour is a variable in the gomoku theme in index.css. Nothing uses a Tailwind
          colour directly.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>Type scale</SectionHeading>
        <Card className="flex flex-col gap-4">
          <div>
            <p className="font-barrio text-5xl sm:text-7xl">Hero</p>
            <p className="text-sm text-muted">Barrio, the landing page and the 404</p>
          </div>
          <div>
            <p className="font-barrio text-4xl">Display</p>
            <p className="text-sm text-muted">Barrio, the logo and page titles</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">Title</p>
            <p className="text-sm text-muted">a screen title, and headings inside a long text</p>
          </div>
          <div>
            <SectionHeading>Label</SectionHeading>
            <p className="text-sm text-muted">section labels, uppercase, via SectionHeading</p>
          </div>
          <div>
            <p>Body</p>
            <p className="text-sm text-muted">the default, everything you read</p>
          </div>
          <div>
            <p className="text-sm">Small</p>
            <p className="text-sm text-muted">quiet actions, timestamps, helper text</p>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>Icons</SectionHeading>
        <Card className="flex flex-wrap items-center gap-6">
          {ICONS.map((name) => (
            <span key={name} className="flex flex-col items-center gap-2">
              <Icon name={name} size={24} />
              <span className="text-sm text-muted">{name}</span>
            </span>
          ))}
        </Card>
        <p className="text-sm text-muted">
          Heroicons (MIT), wrapped in our own Icon component so the size and the stroke width are
          decided in one file.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>Components</SectionHeading>
        <div className="grid gap-4 md:grid-cols-2">
          <Sample name="Card">
            <Card className="w-full">A surface with one radius and one border.</Card>
          </Sample>

          <Sample name="Card, highlighted">
            <Card highlighted className="w-full">Yours, or the one whose turn it is.</Card>
          </Sample>

          <Sample name="PrimaryButton">
            <PrimaryButton variant="solid" size="sm">Find a match</PrimaryButton>
            <PrimaryButton size="sm">Watch</PrimaryButton>
          </Sample>

          <Sample name="PrimaryLink">
            <PrimaryLink to="/design" size="sm">
              <Icon name="back" />
              Back to start
            </PrimaryLink>
          </Sample>

          <Sample name="QuietButton">
            <QuietButton onClick={() => undefined}>Remove friend</QuietButton>
          </Sample>

          <Sample name="BackLink">
            <BackLink to="/design">Back to lobby</BackLink>
          </Sample>

          <Sample name="PlayerLink">
            <PlayerLink userId="design" displayName="ALICE" />
          </Sample>

          <Sample name="Avatar">
            <Avatar displayName="Alice" size="md" />
            <Avatar displayName="Alice" size="lg" />
          </Sample>

          <Sample name="SectionHeading">
            <SectionHeading>Live matches</SectionHeading>
          </Sample>

          <Sample name="ErrorText">
            <ErrorText>Enter a valid email address.</ErrorText>
          </Sample>

          <Sample name="FormField">
            <div className="w-full">
              <FormField id="design-email" label="Email" placeholder="you@example.com" />
            </div>
          </Sample>

          <Sample name="FormField with an error">
            <div className="w-full">
              <FormField
                id="design-email-error"
                label="Email"
                placeholder="you@example.com"
                error="Enter a valid email address."
              />
            </div>
          </Sample>

          <Sample name="LoadingState">
            <LoadingState message="Loading messages…" />
          </Sample>

          <Sample name="EmptyState">
            <EmptyState title="No friends yet" message="Find someone in the lobby and say hello." />
          </Sample>

          <Sample name="ErrorState">
            <ErrorState onRetry={() => undefined} />
          </Sample>
        </div>
      </section>
    </main>
  )
}

export default DesignPage