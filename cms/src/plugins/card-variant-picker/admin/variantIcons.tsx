import React from 'react'
import { CARD_VARIANT_LABELS, type CardVariant } from './variantLabels'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 56 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width="56"
      height="36"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="54"
        height="34"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.4"
      />
      {children}
    </svg>
  )
}

export const VARIANTS: {
  value: CardVariant
  label: string
  icon: React.ReactNode
}[] = [
  {
    value: 'Info',
    label: CARD_VARIANT_LABELS.Info,
    icon: (
      <Frame>
        {/* Soft filled card: title + body lines, no button */}
        <rect
          x="4"
          y="5"
          width="48"
          height="26"
          rx="2.5"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <line
          x1="8"
          y1="11"
          x2="28"
          y2="11"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="18"
          x2="48"
          y2="18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="23"
          x2="45"
          y2="23"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="28"
          x2="40"
          y2="28"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </Frame>
    )
  },
  {
    value: 'Title',
    label: CARD_VARIANT_LABELS.Title,
    icon: (
      <Frame>
        {/* Stacked title + subhead + body + button */}
        <line
          x1="6"
          y1="8"
          x2="30"
          y2="8"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="6"
          y1="14"
          x2="42"
          y2="14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="6"
          y1="19"
          x2="48"
          y2="19"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="6"
          y1="23"
          x2="44"
          y2="23"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <rect
          x="6"
          y="27"
          width="16"
          height="5"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </Frame>
    )
  },
  {
    value: 'Resource',
    label: CARD_VARIANT_LABELS.Resource,
    icon: (
      <Frame>
        {/* Wide two-column: title left, body + button right */}
        <line
          x1="28"
          y1="4"
          x2="28"
          y2="32"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.25"
        />
        <line
          x1="5"
          y1="10"
          x2="24"
          y2="10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="5"
          y1="16"
          x2="20"
          y2="16"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="5"
          y1="22"
          x2="22"
          y2="22"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="9"
          x2="51"
          y2="9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="14"
          x2="51"
          y2="14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="19"
          x2="46"
          y2="19"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <rect
          x="32"
          y="24"
          width="14"
          height="6"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </Frame>
    )
  },
  {
    value: 'Navigation',
    label: CARD_VARIANT_LABELS.Navigation,
    icon: (
      <Frame>
        {/* Left accent bar + title + button */}
        <rect x="5" y="7" width="3" height="22" rx="1.5" fill="currentColor" />
        <line
          x1="13"
          y1="10"
          x2="48"
          y2="10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="13"
          y1="16"
          x2="42"
          y2="16"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect
          x="13"
          y="23"
          width="16"
          height="6"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </Frame>
    )
  }
]
