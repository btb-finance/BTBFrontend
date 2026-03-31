import type { SVGProps } from 'react'
import { Send } from 'lucide-react'

type IconProps = SVGProps<SVGSVGElement> & { className?: string }

/** Telegram-style paper plane (Lucide Send) */
export function IconTelegram({ className }: IconProps) {
  return <Send className={className} strokeWidth={2.25} aria-hidden />
}

/** Discord Clyde-style mark, simplified single path */
export function IconDiscord({ className, ...p }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...p}
    >
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.608 1.25a18.27 18.27 0 0 0-5.487 0c-.163-.393-.406-.874-.618-1.25a.077.077 0 0 0-.078-.037 19.736 19.736 0 0 0-4.885 1.518.07.07 0 0 0-.032.027C.533 9.046-.319 13.58.099 18.058a.082.082 0 0 0 .031.056c2.053 1.507 4.041 2.423 5.993 3.029a.077.077 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 12.3 12.3 0 0 1-1.872-.891.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.372.292a.077.077 0 0 1-.007.127 12.299 12.299 0 0 1-1.873.891.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028c1.961-.607 3.95-1.522 6.002-3.029a.077.077 0 0 0 .031-.055c.5-5.177-.838-9.674-3.548-13.66a.061.061 0 0 0-.031-.029ZM8.122 15.336c-1.144 0-2.083-1.034-2.083-2.309 0-1.273.916-2.308 2.083-2.308 1.18 0 2.104 1.035 2.083 2.308 0 1.275-.916 2.31-2.083 2.31Zm7.814 0c-1.144 0-2.083-1.034-2.083-2.309 0-1.273.916-2.308 2.083-2.308 1.18 0 2.104 1.035 2.083 2.308 0 1.275-.903 2.31-2.083 2.31Z" />
    </svg>
  )
}

/** X (Twitter) logo */
export function IconX({ className, ...p }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...p}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
