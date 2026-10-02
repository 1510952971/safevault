export type ThemeId = 'tactical' | 'midnight' | 'ocean' | 'aurora' | 'rose' | 'paper';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  preview: string;
  accent: string;
  page: string;
  surface: string;
}

export const APP_THEMES: ThemeDefinition[] = [
  {
    id: 'tactical',
    name: '战术荧光',
    description: 'SafeVault 默认工程风格',
    preview: 'from-slate-950 via-slate-800 to-lime-300',
    accent: '#c8f135',
    page: '#f1f3f7',
    surface: '#ffffff'
  },
  {
    id: 'midnight',
    name: '午夜黑曜',
    description: '深色低干扰，适合夜间使用',
    preview: 'from-slate-950 via-slate-800 to-sky-400',
    accent: '#a3e635',
    page: '#0b1220',
    surface: '#111827'
  },
  {
    id: 'ocean',
    name: '深海蓝图',
    description: '清爽蓝灰，突出安全状态',
    preview: 'from-sky-950 via-cyan-700 to-sky-200',
    accent: '#38bdf8',
    page: '#eaf4f7',
    surface: '#f7feff'
  },
  {
    id: 'aurora',
    name: '极光薄荷',
    description: '柔和绿色，降低视觉疲劳',
    preview: 'from-emerald-950 via-teal-700 to-emerald-200',
    accent: '#2dd4bf',
    page: '#eefdf8',
    surface: '#f8fffc'
  },
  {
    id: 'rose',
    name: '玫瑰雾面',
    description: '暖色强调，适合个性化外观',
    preview: 'from-rose-950 via-rose-700 to-rose-200',
    accent: '#fb7185',
    page: '#fff4f4',
    surface: '#fffafa'
  },
  {
    id: 'paper',
    name: '纸张琥珀',
    description: '低饱和纸张质感，阅读友好',
    preview: 'from-stone-900 via-amber-800 to-amber-200',
    accent: '#d97706',
    page: '#f5f1e8',
    surface: '#fffdf7'
  }
];

const THEME_STORAGE_KEY = 'safevault_theme_v1';

export const loadTheme = (): ThemeId => {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    return APP_THEMES.some((theme) => theme.id === saved) ? saved! : 'tactical';
  } catch {
    return 'tactical';
  }
};

export const applyTheme = (theme: ThemeId): void => {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 私有浏览模式或存储被禁用时仍允许当前会话切换主题。
  }
};
