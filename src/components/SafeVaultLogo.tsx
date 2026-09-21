import React from 'react';

interface SafeVaultLogoProps {
  size?: number | string;
  className?: string;
  animated?: boolean;
}

export const SafeVaultLogo: React.FC<SafeVaultLogoProps> = ({
  size = 32,
  className = '',
  animated = true
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
    >
      <defs>
        {/* 背景战术暗金/深黑渐变 */}
        <linearGradient id="svBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="60%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        {/* 签名荧光战术青柠亮绿渐变 */}
        <linearGradient id="svLimeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d9f99d" />
          <stop offset="40%" stopColor="#c8f135" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        {/* 钛合金中层护甲渐变 */}
        <linearGradient id="svArmorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        {/* 荧光微光光晕滤镜 */}
        <filter id="svGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#c8f135" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* 1. 外层八角形重型战术外壳 (Beveled Tactical Octagon) */}
      <path
        d="M 38,10 L 90,10 L 118,38 L 118,90 L 90,118 L 38,118 L 10,90 L 10,38 Z"
        fill="url(#svBgGrad)"
        stroke="#334155"
        strokeWidth="2.5"
      />

      {/* 外框战术边缘凹槽装饰 */}
      <path d="M 42,10 L 86,10" stroke="#475569" strokeWidth="1.5" />
      <path d="M 42,118 L 86,118" stroke="#475569" strokeWidth="1.5" />
      <path d="M 10,42 L 10,86" stroke="#475569" strokeWidth="1.5" />
      <path d="M 118,42 L 118,86" stroke="#475569" strokeWidth="1.5" />

      {/* 四角战术沉头铆钉点 */}
      <circle cx="28" cy="28" r="2" fill="#64748b" />
      <circle cx="100" cy="28" r="2" fill="#64748b" />
      <circle cx="28" cy="100" r="2" fill="#64748b" />
      <circle cx="100" cy="100" r="2" fill="#64748b" />

      {/* 2. 中层六边形装甲安全舱门 (Tactical Armor Door) */}
      <path
        d="M 64,22 L 102,44 L 102,84 L 64,106 L 26,84 L 26,44 Z"
        fill="url(#svArmorGrad)"
        fillOpacity="0.8"
        stroke="#475569"
        strokeWidth="2"
      />

      {/* 荧光绿内轮廓发光线 */}
      <path
        d="M 64,26 L 98,46 L 98,82 L 64,102 L 30,82 L 30,46 Z"
        stroke="url(#svLimeGrad)"
        strokeWidth="2"
        strokeLinejoin="round"
        filter="url(#svGlow)"
      />

      {/* 3. 同心动态刻度雷达环 (Concentric Dial Rings) */}
      <circle
        cx="64"
        cy="64"
        r="24"
        stroke="#64748b"
        strokeWidth="1.5"
        strokeDasharray="6 4"
        strokeOpacity="0.5"
      />
      <circle
        cx="64"
        cy="64"
        r="18"
        stroke="url(#svLimeGrad)"
        strokeWidth="1"
        strokeOpacity="0.6"
        strokeDasharray="12 18"
      />

      {/* 4. 战术锁芯与密钥中枢 (Cybernetic Vault Core) */}
      {/* 锁梁环 */}
      <path
        d="M 52,56 V 46 C 52,39.37 57.37,34 64,34 C 70.63,34 76,39.37 76,46 V 56"
        stroke="url(#svLimeGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* 锁体核心实心盾块 */}
      <rect
        x="46"
        y="54"
        width="36"
        height="30"
        rx="4"
        fill="#0f172a"
        stroke="url(#svLimeGrad)"
        strokeWidth="2"
      />

      {/* 发光锁孔晶体 */}
      <circle cx="64" cy="65" r="4" fill="url(#svLimeGrad)" />
      <path
        d="M 62,67 L 60,76 H 68 L 66,67 Z"
        fill="url(#svLimeGrad)"
      />

      {/* 5. 战术微标细节：右下角荧光斜切刻痕 (Tactical Angle Accents) */}
      <path d="M 88,96 L 94,102" stroke="url(#svLimeGrad)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 94,90 L 102,98" stroke="url(#svLimeGrad)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
};
