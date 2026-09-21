import React from 'react';

interface SafeVaultLogoProps {
  size?: number | string;
  className?: string;
}

export const SafeVaultLogo: React.FC<SafeVaultLogoProps> = ({
  size = 32,
  className = ''
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none shrink-0 ${className}`}
    >
      {/* 极简深色平滑倒角底座 */}
      <rect width="128" height="128" rx="28" fill="#090d16" />
      <rect width="126" height="126" x="1" y="1" rx="27" stroke="#1e293b" strokeWidth="2" />

      {/* 极简粗线条锁梁 (Neon Lime Arch) */}
      <path
        d="M 46 54 V 42 C 46 32.06 54.06 24 64 24 C 73.94 24 82 32.06 82 42 V 54"
        stroke="#c8f135"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* 极简几何盾体 (Tactical Shield Vault Body) */}
      <path
        d="M 34 50 H 94 V 74 C 94 91 64 104 64 104 C 64 104 34 91 34 74 Z"
        fill="#111827"
        stroke="#c8f135"
        strokeWidth="5"
        strokeLinejoin="round"
      />

      {/* 核心极简锁孔光标 (Minimalist Core) */}
      <circle cx="64" cy="69" r="4.5" fill="#c8f135" />
      <rect x="61.5" y="73.5" width="5" height="10" rx="2.5" fill="#c8f135" />

      {/* 右上角单一点状激活指示 (Subtle Active Signal) */}
      <circle cx="106" cy="22" r="3" fill="#c8f135" />
    </svg>
  );
};
