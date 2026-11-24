// Vercel function: live link preview for links the build couldn't fetch.
// All the logic (and the SSRF protection) lives in scripts/link-meta.mjs.
import { previewHandler } from '../scripts/link-meta.mjs'

export default previewHandler
