/**
 * Checks every post against docs/BLOG_GUIDELINES.md (SEO, accessibility, structure).
 *   npm run lint:blog            errors fail, warnings are advice
 *   npm run lint:blog -- --strict  warnings fail too
 */
import { lintPosts } from './blog.mjs'

const { errors, warnings, count } = lintPosts()
for (const w of warnings) console.log(`\x1b[33mwarn\x1b[0m  ${w}`)
for (const e of errors) console.log(`\x1b[31merror\x1b[0m ${e}`)
console.log(`\n${count} posts checked: ${errors.length} errors, ${warnings.length} warnings`)
if (errors.length || (process.argv.includes('--strict') && warnings.length)) process.exit(1)
