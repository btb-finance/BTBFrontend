import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatToken(value: bigint, decimals = 18, dp = 2): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = value / divisor
  const frac = value % divisor
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, dp)
  const wholeStr = whole.toLocaleString('en-US')
  return dp > 0 ? `${wholeStr}.${fracStr}` : wholeStr
}

export function formatEth(value: bigint, dp = 4): string {
  return formatToken(value, 18, dp)
}

export function parseTokenInput(value: string, decimals = 18): bigint {
  if (!value || value === '0') return 0n
  const [whole, frac = ''] = value.split('.')
  const paddedFrac = frac.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFrac)
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatCompact(value: bigint, decimals = 18): string {
  const num = Number(value) / 10 ** decimals
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
  return num.toFixed(2)
}
