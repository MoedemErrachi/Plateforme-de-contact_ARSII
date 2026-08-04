import React from 'react';

interface ArsiiLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const ArsiiLogo: React.FC<ArsiiLogoProps> = ({ 
  className = "w-10 h-10", 
  size,
  showText = true 
}) => {
  const style = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={style}>
      <svg 
        viewBox="0 0 200 200" 
        className="w-full h-full drop-shadow-sm" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="arsiiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#25827c" />
            <stop offset="60%" stopColor="#1a6d68" />
            <stop offset="100%" stopColor="#12524e" />
          </linearGradient>
        </defs>

        {/* Outer Circular Container with Cyan Border */}
        <circle 
          cx="100" 
          cy="100" 
          r="95" 
          fill="url(#arsiiGrad)" 
          stroke="#00f3e2" 
          strokeWidth="6" 
        />

        {/* Small top-left accent dot */}
        <circle cx="42" cy="71" r="5.5" fill="#ffffff" />

        {/* Left 'a' Circle */}
        <circle cx="72" cy="102" r="32" fill="#ffffff" />

        {/* Arrow Stem & Head inside the 'a' Circle */}
        <path 
          d="M60 114 L82 92 M82 92 H67 M82 92 V107" 
          stroke="#1d6e69" 
          strokeWidth="8.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />

        {/* 'rsii' Text */}
        <g fill="#ffffff">
          {/* 'r' */}
          <path d="M112 90 v26 h-7.5 V90 h7.5 M108 96 c2 -4 6 -6.5 10 -6.5 v7.5 c-4 0 -7 2.5 -7.5 6" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* 's' */}
          <path d="M133 93 c-2 -2 -5 -3 -8 -3 c-4 0 -7 2 -7 5 c0 7 15 3 15 11 c0 5 -4 8 -9 8 c-5 0 -8 -2 -11 -5 l4 -5 c2 2 4 4 7 4 c4 0 7 -2 7 -4.5 c0 -7.5 -15 -3.5 -15 -11.5 c0 -5 4 -8 9 -8 c4 0 7 1.5 9 4z" />

          {/* 'i' (first) */}
          <circle cx="145" cy="88" r="3.5" />
          <rect x="142" y="94" width="6" height="22" rx="2" />

          {/* 'i' (second) */}
          <circle cx="158" cy="88" r="3.5" />
          <rect x="155" y="94" width="6" height="22" rx="2" />
        </g>
      </svg>
    </div>
  );
};
