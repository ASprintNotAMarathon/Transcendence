import {
  ArrowLeftIcon,
  ChatBubbleLeftIcon,
  PaperAirplaneIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

/*
  Icon. One place that decides which icons we use and how big they are, so a
  component never imports from Heroicons directly. Swapping the set later,
  or changing the default size, happens here and nowhere else.
 
  Heroicons (MIT) matches our stack: same makers as Tailwind, outline style
  with a stroke of 1.5, which is the same weight as our 2px borders.
 
    <Icon name="back" />             16px, the default
    <Icon name="close" size={20} />  bigger
 
  Icons are decorative: they sit next to a label, or inside a button that
  carries its own aria-label. That is why they are hidden from screen readers.
*/

const ICONS = {
  back: ArrowLeftIcon,
  close: XMarkIcon,
  send: PaperAirplaneIcon,
  addFriend: UserPlusIcon,
  message: ChatBubbleLeftIcon,
}

export type IconName = keyof typeof ICONS

type IconProps = {
  name: IconName
  size?: number
  className?: string
}

function Icon({ name, size = 16, className = '' }: IconProps) {
  const Shape = ICONS[name]
  return <Shape width={size} height={size} strokeWidth={3} aria-hidden="true" className={`shrink-0 ${className}`} />
}

export default Icon