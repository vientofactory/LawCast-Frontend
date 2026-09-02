// Re-exports only the write utilities actually used, so bundlers can tree-shake the rest of SheetJS.
export { utils, writeFileXLSX } from 'xlsx';
