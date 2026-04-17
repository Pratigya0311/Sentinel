import { useId } from "react"

export function BrandMark({ className = "" }) {
  const id = useId().replace(/:/g, "")

  const gShield = `bm-shield-${id}`
  const gInner = `bm-inner-${id}`

  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <svg className="brand-mark-svg" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gShield} x1="10" y1="5" x2="30" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7fd4ff" />
            <stop offset="0.5" stopColor="#4eb8ff" />
            <stop offset="1" stopColor="#5af0c4" />
          </linearGradient>
          <linearGradient id={gInner} x1="20" y1="10" x2="20" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1a3348" />
            <stop offset="1" stopColor="#0a121a" />
          </linearGradient>
        </defs>
        <path
          d="M20 4.5 33 9.2v11.4c0 8.1-5.4 15.6-13 17.9L20 35l-.2.1c-7.6-2.3-13-9.8-13-17.9V9.2L20 4.5Z"
          stroke={`url(#${gShield})`}
          strokeWidth="2"
          strokeLinejoin="round"
          fill={`url(#${gInner})`}
        />
        <path
          d="M20 8.2 29.2 11.4v9.4c0 6.2-4.1 12-9.9 13.7L20 30.2l.7-.3c5.8-1.7 9.9-7.5 9.9-13.7v-9.4L20 8.2Z"
          fill="rgba(8,14,22,0.92)"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
        />
        <circle cx="20" cy="19" r="6.2" stroke={`url(#${gShield})`} strokeWidth="1.5" fill="none" />
        <path
          d="M20 12.2v3.2M27.2 19h-3.2M20 25.8v-3.2M12.8 19h3.2"
          stroke="#b8f0ff"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="20" cy="19" r="2" fill="#7dffb3" stroke="#0d1f18" strokeWidth="0.75" />
      </svg>
    </span>
  )
}
