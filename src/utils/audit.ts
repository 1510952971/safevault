/**
 * SafeVault 密码安全审计与健康评估引擎
 * 自动检测全库弱密码、跨站点重复使用密码并计算综合安全防护健康得分
 */

import { DecryptedVaultItem, VaultSecurityAudit } from '../types/vault';
import { calculatePasswordStrength } from './crypto';

export interface DetailedSecurityAudit extends VaultSecurityAudit {
  weakItemIds: string[];
  reusedItemIds: string[];
  reusedGroups: Record<string, string[]>; // password -> item titles
}

export function performSecurityAudit(allItems: DecryptedVaultItem[]): DetailedSecurityAudit {
  const items = allItems.filter((i) => !i.isDeleted);
  const totalItems = items.length;
  if (totalItems === 0) {
    return {
      totalItems: 0,
      favoriteCount: 0,
      weakCount: 0,
      reusedCount: 0,
      healthScore: 100,
      riskyItemIds: [],
      weakItemIds: [],
      reusedItemIds: [],
      reusedGroups: {}
    };
  }

  const favoriteCount = items.filter((i) => i.isFavorite).length;

  // 1. 弱密码检测
  const weakItemIds: string[] = [];
  items.forEach((item) => {
    const strength = calculatePasswordStrength(item.password);
    if (strength.score < 55 || item.password.length < 8) {
      weakItemIds.push(item.id);
    }
  });

  // 2. 重复密码检测
  const passwordMap = new Map<string, DecryptedVaultItem[]>();
  items.forEach((item) => {
    if (!item.password) return;
    const existing = passwordMap.get(item.password) || [];
    existing.push(item);
    passwordMap.set(item.password, existing);
  });

  const reusedItemIdsSet = new Set<string>();
  const reusedGroups: Record<string, string[]> = {};

  passwordMap.forEach((matchedItems, pwd) => {
    if (matchedItems.length > 1) {
      reusedGroups[pwd.slice(0, 3) + '***'] = matchedItems.map((i) => i.title);
      matchedItems.forEach((i) => reusedItemIdsSet.add(i.id));
    }
  });

  const reusedItemIds = Array.from(reusedItemIdsSet);

  // 3. 风险凭据集合 (并集)
  const riskySet = new Set<string>([...weakItemIds, ...reusedItemIds]);
  const riskyItemIds = Array.from(riskySet);

  // 4. 综合健康评分计算 (0 ~ 100)
  // 基准分 100
  // 每项弱密码扣 12 分
  // 每项重复密码扣 10 分
  // 达到高强度（>=80）比例予以加权加分
  let deduction = weakItemIds.length * 12 + reusedItemIds.length * 10;
  let score = Math.max(20, 100 - deduction);

  // 若存在风险项，最高不超过 85 分
  if (riskyItemIds.length > 0 && score > 85) {
    score = 85;
  }

  return {
    totalItems,
    favoriteCount,
    weakCount: weakItemIds.length,
    reusedCount: reusedItemIds.length,
    healthScore: score,
    riskyItemIds,
    weakItemIds,
    reusedItemIds,
    reusedGroups
  };
}
