/**
 * raw 顶层负载类型定义。
 *
 * 这个文件定义 FluxBin `raw` 模式支持的顶层基础类型。
 * 它只服务顶层原始值传输，不参与 typed shape registry 路由。
 */
export const RAW_TYPE_CODES = {
  bool: 7,
  i16: 4,
  i32: 6,
  i8: 2,
  u16: 3,
  u32: 5,
  u8: 1,
  "utf8-string": 8
} as const;

export type RawScalarType = keyof typeof RAW_TYPE_CODES;

export type RawScalarValueMap = {
  bool: boolean;
  i16: number;
  i32: number;
  i8: number;
  u16: number;
  u32: number;
  u8: number;
  "utf8-string": string;
};

export type RawScalarTypeValue<TRawType extends RawScalarType> = RawScalarValueMap[TRawType];

export type RawScalarValue = RawScalarValueMap[RawScalarType];

export type RawScalarArrayValueMap = {
  [TRawType in RawScalarType]: RawScalarTypeValue<TRawType>[];
};

export type RawScalarArrayTypeValue<TRawType extends RawScalarType> = RawScalarArrayValueMap[TRawType];

export type RawScalarArrayValue = RawScalarArrayValueMap[RawScalarType];

const rawTypeCodeEntries = Object.entries(RAW_TYPE_CODES) as Array<[RawScalarType, number]>;

export function getRawTypeCode(rawType: RawScalarType): number {
  return RAW_TYPE_CODES[rawType];
}

export function getRawTypeFromCode(code: number): RawScalarType | undefined {
  for (const [rawType, rawCode] of rawTypeCodeEntries) {
    if (rawCode === code) {
      return rawType;
    }
  }

  return undefined;
}
