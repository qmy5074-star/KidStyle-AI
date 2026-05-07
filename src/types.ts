/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserType {
  PARENT = 'PARENT',
  STORE_OWNER = 'STORE_OWNER',
}

export enum ItemCategory {
  TOPS = 'TOPS',
  BOTTOMS = 'BOTTOMS',
  DRESSES = 'DRESSES',
  ACCESSORIES = 'ACCESSORIES',
  SHOES = 'SHOES',
}

export interface ClothingItem {
  id: string;
  name: string;
  category: ItemCategory;
  imageUrl: string;
  brand?: string;
  description?: string;
  tags?: string[];
  style?: string;
  isIdentified?: boolean;
  createdAt?: number;
}

export interface TuningRecord {
  id: string;
  prompt: string;
  referenceImage?: string | null;
  resultFittingImage?: string | null;
  timestamp: number;
}

export interface StylingPlan {
  id: string;
  mainItemId: string;
  matchedItemIds: string[];
  vibe: string;
  description: string;
  fittingImage?: string;
  tuningRecords?: TuningRecord[];
}

export interface GeneratedAsset {
  id: string;
  type: 'COVER' | 'GROUP' | 'DETAILS';
  imageUrl: string;
}
