import React from 'react'
import { LAYOUT_TYPE_LABELS, type LayoutType } from './layoutTypeLabels'

export const LAYOUTS: { value: LayoutType; label: string; icon: React.ReactNode }[] = [
  {
    value: 'image-text',
    label: LAYOUT_TYPE_LABELS['image-text'],
    icon: (
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
        <line
          x1="28"
          y1="1"
          x2="28"
          y2="35"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.3"
        />
        <rect
          x="5"
          y="8"
          width="18"
          height="12"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M5 16l4-4 3 3 2.5-2.5L21 20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="12" r="1.5" fill="currentColor" />
        <line
          x1="32"
          y1="10"
          x2="51"
          y2="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="15"
          x2="51"
          y2="15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="20"
          x2="44"
          y2="20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    value: 'image-quote',
    label: LAYOUT_TYPE_LABELS['image-quote'],
    icon: (
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
        <line
          x1="28"
          y1="1"
          x2="28"
          y2="35"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.3"
        />
        <rect
          x="5"
          y="8"
          width="18"
          height="12"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M5 16l4-4 3 3 2.5-2.5L21 20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="12" r="1.5" fill="currentColor" />
        <path
          d="M33 10c0 2.5-1 4-3 4v2c3 0 5-2 5-6v-2h-2v2zm6 0c0 2.5-1 4-3 4v2c3 0 5-2 5-6v-2h-2v2z"
          fill="currentColor"
        />
        <line
          x1="32"
          y1="22"
          x2="48"
          y2="22"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.5"
        />
      </svg>
    )
  },
  {
    value: 'video-text',
    label: LAYOUT_TYPE_LABELS['video-text'],
    icon: (
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
        <line
          x1="28"
          y1="1"
          x2="28"
          y2="35"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.3"
        />
        <circle cx="14" cy="18" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11.5 14.5l8 3.5-8 3.5V14.5z" fill="currentColor" />
        <line
          x1="32"
          y1="10"
          x2="51"
          y2="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="15"
          x2="51"
          y2="15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="20"
          x2="44"
          y2="20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    value: 'video-quote',
    label: LAYOUT_TYPE_LABELS['video-quote'],
    icon: (
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
        <line
          x1="28"
          y1="1"
          x2="28"
          y2="35"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.3"
        />
        <circle cx="14" cy="18" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11.5 14.5l8 3.5-8 3.5V14.5z" fill="currentColor" />
        <path
          d="M33 10c0 2.5-1 4-3 4v2c3 0 5-2 5-6v-2h-2v2zm6 0c0 2.5-1 4-3 4v2c3 0 5-2 5-6v-2h-2v2z"
          fill="currentColor"
        />
        <line
          x1="32"
          y1="22"
          x2="48"
          y2="22"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.5"
        />
      </svg>
    )
  }
]
