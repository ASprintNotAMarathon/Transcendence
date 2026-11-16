type Props = {
    open: boolean
    unread: number
    onToggle: () => void
  }
  
  /*
    ChatButton. Opens and closes the chat popup.
  
    Closed: a sage speech bubble with the unread count, or three dots when
    there is nothing new. Open: a sage cross. On a phone the cross moves to
    the top right, so it never covers the composer.
  */
  function ChatButton({ open, unread, onToggle }: Props) {
    const label = open ? 'Close chat' : unread > 0 ? `Open chat, ${unread} unread messages` : 'Open chat'
  
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        className={`cursor-pointer ${open ? 'rounded-full' : 'rounded-xl'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-primary) ${open ? 'max-sm:fixed max-sm:top-2 max-sm:right-2' : ''}`}
      >
        {open ? (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-(--color-secondary) text-lg font-bold text-(--color-base-100)"
          >
            ✕
          </span>
        ) : (
          <svg aria-hidden="true" width="52" height="48" viewBox="0 0 52 48">
            <path
              className="fill-(--color-secondary)"
              transform="translate(52 0) scale(-1 1)"
              d="M10 4h32a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H24l-10 9v-9h-4a8 8 0 0 1-8-8V12a8 8 0 0 1 8-8z"
            />
            {unread > 0 ? (
              <text x="26" y="26.5" textAnchor="middle" fontSize="17" fontWeight="800" className="fill-(--color-base-100)">
                {unread}
              </text>
            ) : (
              <g className="fill-(--color-base-100)">
                <circle cx="17" cy="20" r="2.6" />
                <circle cx="26" cy="20" r="2.6" />
                <circle cx="35" cy="20" r="2.6" />
              </g>
            )}
          </svg>
        )}
      </button>
    )
  }
  
  export default ChatButton