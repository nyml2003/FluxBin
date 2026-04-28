export type Endian = "little" | "big";

export function isLittleEndian(endian: Endian): boolean {
  return endian === "little";
}
