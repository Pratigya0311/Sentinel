const base = { xmlns: "http://www.w3.org/2000/svg", fill: "none", "aria-hidden": "true" }

export function IconTrend({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <path
        d="M4 16.5 8.5 12l3 3 4.5-6L20 12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <circle cx="18" cy="6" r="2.25" fill="currentColor" opacity="0.35" />
      <path d="M18 8.5v2M18 3.5v2M15.5 6h-2M22.5 6h-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

export function IconDatabase({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <ellipse cx="12" cy="6" rx="8" ry="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 6v5c0 1.8 3.6 3.25 8 3.25S20 12.8 20 11V6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4 11v5c0 1.8 3.6 3.25 8 3.25S20 17.8 20 16v-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4 16v2.5c0 1.35 3.15 2.75 8 2.75s8-1.4 8-2.75V16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export function IconActivity({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <path d="M4 14h3l2-6 4 12 2-6h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconGauge({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <path
        d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M12 14v3M4.5 19h15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M6.5 8.5 4 5M17.5 8.5 20 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

export function IconCheck({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <path
        d="M7 12.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </svg>
  )
}

export function IconBlock({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" opacity="0.45" />
      <path d="M8 16 16 8" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
    </svg>
  )
}

export function IconCoins({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 6v3c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 9v3c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 12v3c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function IconSliders({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <path d="M4 7h4M15 7h6M10 7h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4 12h10M18 12h2M15 12h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4 17h6M13 17h7M11 17h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="9" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="17" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function IconBarsSplit({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <path d="M8 18V8M12 18v-5M16 18V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 20h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  )
}

export function IconServer({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <rect x="5" y="4" width="14" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.65" />
      <rect x="5" y="14" width="14" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.65" />
      <path d="M8 7h.01M8 17h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconShield({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <path
        d="M12 3 20 6v6c0 5-3.5 9.2-8 10.4L12 22l-.2-.1C7.3 21.2 4 17 4 12V6l8-3Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path d="M9 12.5 11 14.5 16 9.5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconHistory({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <path
        d="M5.5 11.5c.8-3.4 3.9-6 7.5-6a7.5 7.5 0 0 1 7.1 5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <path d="M4 8v4h4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconSparkline({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <path d="M4 16.5 9 11l3.5 3.5L20 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.35" />
    </svg>
  )
}

export function IconUsers({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <path
        d="M16 18v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M12 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M20 8.2a3 3 0 0 1 0 5.6M21 18v-.5a3 3 0 0 0-2.2-2.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
    </svg>
  )
}

export function IconRoute({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.65" />
      <circle cx="17" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.65" />
      <path d="M9.2 9.2 15 15" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </svg>
  )
}

export function IconDeny({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <path
        d="M12 4 4 8v8l8 4 8-4V8l-8-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 10l6 6M15 10l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconRadar({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...base}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <path d="M12 12 17 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.85" />
    </svg>
  )
}
