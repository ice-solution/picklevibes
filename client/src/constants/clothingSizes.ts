/** 與後端 server/utils/clothingSizes.js 一致 */
export const CLOTHING_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL'] as const;
export type ClothingSize = (typeof CLOTHING_SIZE_OPTIONS)[number];
