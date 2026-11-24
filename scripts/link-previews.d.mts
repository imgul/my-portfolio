export function buildManifest(opts?: { dist?: string | null; fetchExternal?: boolean; log?: (msg: string) => void }): Promise<Record<string, unknown>>
export function writeSnapshot(opts?: { dist?: string | null; log?: (msg: string) => void }): Promise<{ links: Record<string, unknown>; failed: string[] }>
export function readSnapshot(): Record<string, { at: number; entry: Record<string, unknown>; icon?: { type: string; ext: string; hash: string; b64: string } }>
