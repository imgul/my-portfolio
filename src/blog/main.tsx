import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/400-italic.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/source-serif-4/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/syne/800.css'
import 'katex/dist/katex.min.css'
import './blog.css'
import { applyPrefs } from './prefs'
import BlogApp from './BlogApp'

applyPrefs()
document.documentElement.style.background = ''
createRoot(document.getElementById('root')!).render(<BlogApp />)
