/**
 * Men's shirt size chart. Body measurements in inches.
 * Used on the Size Guide page and on every product page.
 */

export interface SizeRow {
  size: string;
  neck: number;
  chest: number;
  shoulder: number;
  sleeve: number;
  length: number;
}

export const SIZE_CHART: SizeRow[] = [
  { size: 'S', neck: 15, chest: 38, shoulder: 17, sleeve: 24.5, length: 28 },
  { size: 'M', neck: 15.5, chest: 40, shoulder: 17.5, sleeve: 25, length: 29 },
  { size: 'L', neck: 16, chest: 42, shoulder: 18, sleeve: 25.5, length: 29.5 },
  { size: 'XL', neck: 16.5, chest: 44, shoulder: 18.5, sleeve: 26, length: 30 },
  { size: 'XXL', neck: 17, chest: 46, shoulder: 19, sleeve: 26.5, length: 30.5 },
];

export const SIZE_COLUMNS: Array<{ key: keyof Omit<SizeRow, 'size'>; label: string }> = [
  { key: 'neck', label: 'Neck' },
  { key: 'chest', label: 'Chest' },
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'sleeve', label: 'Sleeve' },
  { key: 'length', label: 'Length' },
];

export function toCm(inches: number): number {
  return Math.round(inches * 2.54);
}
