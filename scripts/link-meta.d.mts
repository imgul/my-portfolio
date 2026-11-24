/** GET /api/link-preview?url=… (Node-style req/res; used by the Vercel function and the Vite dev/preview server). */
export function previewHandler(req: unknown, res: unknown): Promise<void>
/** Canonical cache key for a URL (no hash or tracking parameters, sorted query). */
export function normalizeUrl(input: string): string
