export type CatalogShape<T> = {
  -readonly [K in keyof T]: T[K] extends string ? string : CatalogShape<T[K]>;
};
