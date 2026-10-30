import { useState } from 'react'

type ResignButtonProps = {
  onResign: () => void
}

const buttonClass = 'btn btn-sm tracking-wide border-2 btn-outline-accent'

function ResignButton({ onResign }: ResignButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [sent, setSent] = useState(false)

  if (!confirming) {
    return (
      <button type="button" className={`self-start ${buttonClass}`} onClick={() => setConfirming(true)}>
        Resign
      </button>
    )
  }

  const resign = () => {
    setSent(true)
    onResign()
  }

  return (
    <div role="group" aria-label="Confirm resignation" className="flex flex-col gap-2">
      <p className="text-sm">Resign this match?</p>
      <div className="flex gap-2">
        <button type="button" className={buttonClass} disabled={sent} onClick={resign}>
          Yes, resign
        </button>
        <button type="button" className={buttonClass} disabled={sent} onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default ResignButton
