// All portfolio copy lives here, so it can be edited without touching components.

export const profile = {
  name: 'Muhammad Gulzaib',
  short: 'Gul',
  role: 'Founder & Senior Full Stack Engineer',
  headline: 'Laravel · React · AI Systems · SaaS',
  /** one-line pitch: share image, page title and search snippet */
  tagline: 'I build systems that become businesses.',
  email: 'iigulzaib@gmail.com',
  phone: '+92 302 6999 008',
  phoneHref: 'https://wa.me/923026999008',
  location: 'Islamabad, Pakistan',
  timezone: 'Asia/Karachi',
  // the canonical address (set VITE_SITE_URL when a custom domain is connected)
  website: ((import.meta.env?.VITE_SITE_URL as string | undefined) || 'https://gulzaib.vercel.app').replace(/\/$/, ''),
  availability: 'Open to remote roles & relocation: UAE / KSA',
  socials: [
    { label: 'LinkedIn', handle: 'gulzaib-ai', url: 'https://www.linkedin.com/in/gulzaib-ai' },
    { label: 'GitHub', handle: 'imgul', url: 'https://github.com/imgul' },
    { label: 'X', handle: '@gulzaib_ai', url: 'https://x.com/gulzaib_ai' },
    { label: 'Email', handle: 'iigulzaib@gmail.com', url: 'mailto:iigulzaib@gmail.com' },
  ],
}

export const manifesto =
  "I don't just write code. I build systems that turn into businesses: SaaS platforms, AI agents and the plumbing in between. I go from schema to sales call, and from a RAG pipeline to a product someone actually pays for."

export const stats = [
  { value: 5, suffix: '+', label: 'Years shipping production software' },
  { value: 6, suffix: '', label: 'Products founded, co-founded or built' },
  { value: 25, suffix: '+', label: 'Technologies in my daily toolkit' },
  { value: 30, suffix: '%', label: 'Team productivity lift from mentoring' },
]

export type Chapter = {
  year: string
  place: string
  title: string
  org: string
  period: string
  body: string
  tags: string[]
  url?: string
}

export const journey: Chapter[] = [
  {
    year: '2018',
    place: 'Burewala',
    title: 'The curious kid with a computer',
    org: 'Self-taught',
    period: 'College, Year 1',
    body: 'Started with Office, hardware and graphic design (CorelDRAW, Photoshop, Illustrator, Premiere). That is where I learned to care about how things look and feel.',
    tags: ['Design', 'Photoshop', 'Illustrator'],
  },
  {
    year: '2019',
    place: 'Burewala → Faisalabad',
    title: 'View source → backend',
    org: 'YouTube University',
    period: '2019',
    body: 'Learned HTML and CSS from YouTube, then kept asking "but how does it save?" That question got me into PHP and MySQL. Started my BS in Software Engineering the same year.',
    tags: ['HTML', 'CSS', 'PHP', 'MySQL'],
  },
  {
    year: '2022',
    place: 'Lahore · Remote',
    title: 'Full Stack Developer',
    org: 'RZ Lab · Freelance',
    period: 'Jan 2022 – May 2023',
    body: 'Built custom and CMS-based e-commerce with Laravel, React and WordPress. Freelanced on Laravel apps covering database design, APIs and performance work for clients.',
    tags: ['Laravel', 'React', 'WordPress', 'APIs'],
  },
  {
    year: '2023',
    place: 'Lahore',
    title: 'PHP Developer',
    org: 'Bitz Studio',
    period: 'Apr 2023 – May 2024',
    body: 'Scaled SaaS and enterprise apps across Core PHP, CodeIgniter, Laravel, Symfony and React on the cloud. Brought AI-based management systems in, and shipped WordPress plugins to the marketplace.',
    tags: ['SaaS', 'Symfony', 'Cloud', 'AI'],
    url: 'https://bitzstudio.com',
  },
  {
    year: '2024',
    place: 'Islamabad',
    title: 'PHP Laravel Developer',
    org: 'DW Solution Online',
    period: 'Jun 2024 – Sep 2024',
    body: 'Built AI-integrated APIs and web apps with Laravel and Python Flask, with security, MVC and OOP done properly from day one.',
    tags: ['Laravel', 'Flask', 'AI APIs'],
    url: 'https://dwsolutionline.com/',
  },
  {
    year: '2024',
    place: 'Lahore',
    title: 'Senior Software Engineer',
    org: 'Exertlogics',
    period: 'Sep 2024 – 2025',
    body: 'Led high-performance e-commerce builds in PHP and React. Mentored juniors (+30% team productivity), helped hire engineers, and wired third-party AI services into client products through Laravel and Flask APIs.',
    tags: ['Leadership', 'Hiring', 'React', 'AI'],
    url: 'https://exertlogics.com',
  },
  {
    year: '2025',
    place: 'Islamabad',
    title: 'Founder & CEO',
    org: 'SynergyFlow Labs',
    period: '2025 – Present',
    body: 'Moved from selling hours to building products. An AI-first studio for agentic SaaS, MVPs, ERPs and automation that runs real business operations.',
    tags: ['Founder', 'Agentic AI', 'SaaS', 'ERP'],
  },
  {
    year: 'Next',
    place: 'Anywhere',
    title: 'Your team, maybe?',
    org: 'Remote · UAE · KSA',
    period: '2026 →',
    body: 'I am looking for ambitious teams where engineering depth and founder thinking both count. If you are building something hard, let us talk.',
    tags: ['Remote', 'Relocation', 'Leadership'],
  },
]

export type Venture = {
  name: string
  kicker: string
  role: string
  status: string
  tagline: string
  body: string
  points: string[]
  url?: string
  hue: string
  hue2: string
}

export const ventures: Venture[] = [
  {
    name: 'SynergyFlow Labs',
    kicker: '01 · Company',
    role: 'Founder & CEO',
    status: 'Operating',
    tagline: 'An AI-native product studio.',
    body: 'My company. We design and ship agentic AI SaaS, MVPs, ERPs and business automation, where software does the work instead of only showing it.',
    points: ['Agentic AI products', 'MVPs for founders', 'Custom ERP & CRM', 'AI integrations'],
    hue: '#c6ff3d',
    hue2: '#3dffb5',
  },
  {
    name: 'Oxygen LMS',
    kicker: '02 · EdTech',
    role: 'Founder · Architect',
    status: 'Building',
    tagline: 'An operating system for education.',
    body: 'Schools, colleges and academies on one platform: academics, attendance, fees, HR, parents and AI assistants. Simple and mobile-first, built for people who would rather not use software at all.',
    points: ['Laravel SaaS backend', 'Attendance · reporting · users', 'Multi-tenant architecture', 'AI teaching assistants'],
    url: 'https://oxygenlms.com',
    hue: '#5b8cff',
    hue2: '#a46bff',
  },
  {
    name: 'AnySub',
    kicker: '03 · SaaS',
    role: 'Founder · Builder',
    status: 'Building in public',
    tagline: 'Any subscription. One system.',
    body: 'A calm, serious operating system for subscriptions. Track every SaaS tool, free trial and renewal, with budgets, audit trails and team comments.',
    points: ['Trial & renewal tracking', 'Budgets & spend visibility', 'Audit history', 'Team collaboration'],
    url: 'https://anysub.app',
    hue: '#ff6b3d',
    hue2: '#ffc93d',
  },
  {
    name: 'ZeroExam AI',
    kicker: '04 · AI × Education',
    role: 'Founder · AI Engineer',
    status: 'Prototyping',
    tagline: 'Exams written in minutes, not weekends.',
    body: 'Teachers pick subjects, topics and difficulty, and AI drafts structured, customisable exam papers. Next up: AI-assisted checking of written answers for competitive exams.',
    points: ['LLM paper generation', 'Difficulty & format control', 'RAG over syllabus', 'AI answer evaluation (R&D)'],
    hue: '#ff3d8b',
    hue2: '#ff8a3d',
  },
  {
    name: 'Sehat Bunyad',
    kicker: '05 · HealthTech',
    role: 'CTO · Co-founder',
    status: 'NIC Lahore Cohort 3 · Shortlisted',
    tagline: 'Technology for better healthcare access.',
    body: 'As CTO I own the technical vision, architecture and product engineering of a healthcare startup shortlisted for National Incubation Center Lahore, Cohort 3.',
    points: ['Technical strategy', 'System architecture', 'Product engineering', 'Team building'],
    hue: '#3dd6ff',
    hue2: '#3dffb5',
  },
  {
    name: 'Voice Agents',
    kicker: '06 · R&D',
    role: 'Researcher · Builder',
    status: 'Exploring',
    tagline: 'AI that calls in Urdu, Punjabi & Pashto.',
    body: 'Affordable voice automation for Pakistani businesses: support, sales follow-ups, appointment booking and lead qualification in local languages, connected to WhatsApp and SMS.',
    points: ['Speech ↔ LLM pipelines', 'Local-language voice', 'WhatsApp / SMS', 'Cost-efficient inference'],
    hue: '#b56bff',
    hue2: '#5b8cff',
  },
]

export type Skill = { name: string; level: number }
export type SkillGroup = { group: string; skills: Skill[] }

export const stack: SkillGroup[] = [
  {
    group: 'Backend',
    skills: [
      { name: 'PHP', level: 5 },
      { name: 'Laravel', level: 5 },
      { name: 'CodeIgniter', level: 5 },
      { name: 'Symfony', level: 4 },
      { name: 'Python', level: 4 },
      { name: 'Flask', level: 4 },
      { name: 'REST APIs', level: 5 },
      { name: 'PHPUnit', level: 4 },
    ],
  },
  {
    group: 'Frontend',
    skills: [
      { name: 'JavaScript', level: 5 },
      { name: 'React', level: 4 },
      { name: 'Next.js', level: 4 },
      { name: 'Vue', level: 3 },
      { name: 'Tailwind', level: 5 },
      { name: 'SASS', level: 5 },
      { name: 'HTML5', level: 5 },
      { name: 'jQuery', level: 5 },
    ],
  },
  {
    group: 'AI',
    skills: [
      { name: 'RAG', level: 4 },
      { name: 'Agentic AI', level: 4 },
      { name: 'OpenAI API', level: 5 },
      { name: 'Hugging Face', level: 3 },
      { name: 'LLM Tooling', level: 4 },
      { name: 'Automation', level: 5 },
    ],
  },
  {
    group: 'Data & Ops',
    skills: [
      { name: 'MySQL', level: 5 },
      { name: 'MongoDB', level: 3 },
      { name: 'Docker', level: 3 },
      { name: 'CI/CD', level: 3 },
      { name: 'Linux / CLI', level: 5 },
      { name: 'Nginx', level: 4 },
      { name: 'AWS / Azure', level: 3 },
      { name: 'Git', level: 5 },
    ],
  },
  {
    group: 'Craft',
    skills: [
      { name: 'System Design', level: 4 },
      { name: 'Design Patterns', level: 4 },
      { name: 'OOP · SOLID', level: 5 },
      { name: 'Shopify', level: 4 },
      { name: 'Mentoring', level: 5 },
      { name: 'Product', level: 4 },
    ],
  },
]

export type Agent = { id: string; name: string; role: string; log: string[] }

export const agents: Agent[] = [
  {
    id: 'research',
    name: 'Research',
    role: 'Finds signal',
    log: ['> crawling market sources…', '> embedding 1,284 documents', '> retrieved top-k = 8 (RAG)', '✓ brief ready for planner'],
  },
  {
    id: 'planning',
    name: 'Planning',
    role: 'Breaks it down',
    log: ['> goal: launch pilot with 5 schools', '> decomposing into 14 tasks', '> assigning owners: sales, coding, ops', '✓ plan approved by human-in-the-loop'],
  },
  {
    id: 'coding',
    name: 'Coding',
    role: 'Ships features',
    log: ['> php artisan make:model Attendance -mcr', '> writing tests… 42 passed', '> opening pull request #128', '✓ deployed to staging'],
  },
  {
    id: 'sales',
    name: 'Sales',
    role: 'Opens doors',
    log: ['> qualifying 37 leads', '> drafting WhatsApp follow-ups (Urdu)', '> booking 6 demos', '✓ CRM updated'],
  },
  {
    id: 'support',
    name: 'Support',
    role: 'Keeps users happy',
    log: ['> ticket: "fee voucher not printing"', '> searching knowledge base…', '> resolved with step-by-step fix', '✓ CSAT 5/5'],
  },
  {
    id: 'ops',
    name: 'Operations',
    role: 'Runs the machine',
    log: ['> monitoring queues & cron', '> scaling workers 2 → 6', '> invoice batch generated', '✓ all systems nominal'],
  },
]

export const education = {
  school: 'Virtual University of Pakistan',
  degree: 'BS Software Engineering',
  period: '2019 – 2023',
  grade: 'Grade A',
  url: 'https://vu.edu.pk',
  roles: [
    'GitHub Campus Expert',
    'Google Developer Student Club Ambassador',
    'Management Head, Technological Advancement Society',
    'Technical Editor, VU Bytes Magazine',
    'Bootcamp host, on campus & online',
    'Member, Business Management Society',
  ],
}

export const certifications = [
  { title: 'Data Science, ML, Deep Learning & NLP Bootcamp', issuer: 'KRISHAI Technologies', date: 'Nov 2024' },
  { title: 'Beginning Laravel: Novice to Professional', issuer: 'TutsPrime', date: 'May 2023' },
  { title: 'Web Development Masterclass', issuer: 'YouAccel', date: 'Feb 2023' },
  { title: 'Modern PHP w/ MySQL, GitHub & Heroku', issuer: 'Learn IT University', date: 'Feb 2023' },
  { title: 'Complete React Developer Masterclass', issuer: 'Data Is Good Academy', date: 'Jan 2023' },
  { title: 'Certified Web Professional: E-Commerce Specialist', issuer: 'IBM', date: 'Oct 2022' },
  { title: 'NGINX, PHP, MySQL, SSL & WordPress on Ubuntu', issuer: 'YouAccel', date: 'Sep 2022' },
  { title: 'JavaScript, Bootstrap & PHP', issuer: 'YouAccel', date: 'Apr 2022' },
]

export const lessons = [
  { n: '01', slug: 'code-is-not-a-business', title: 'Code is not a business.', body: 'I shipped a POS SaaS that reached around 20 paying customers. Then I learned the market needed offline-first. Now I validate before I build.' },
  { n: '02', slug: 'distribution-beats-features', title: 'Distribution beats features.', body: 'Cold calls to schools taught me more than any framework did. Most of the work is getting the product in front of the right people.' },
  { n: '03', slug: 'simple-wins', title: 'Simple wins.', body: 'People pick software they enjoy over software with the longest feature list, so I design for the least technical user in the room.' },
]

export const beyond = [
  { title: 'Agentic AI', body: 'RAG, multi-agent orchestration and tools that do real work rather than just produce text.', glyph: '✲' },
  { title: 'Margalla Hills', body: 'Islamabad’s trails are where I do my best thinking.', glyph: '▲' },
  { title: 'Two wheels', body: 'Short motorcycle trips into the mountains, one or two nights at a time.', glyph: '◎' },
  { title: 'Open source', body: 'Contributing to projects that solve real problems for real people.', glyph: '{ }' },
  { title: 'Community', body: 'Hackathons, bootcamps and summits. I learn fastest in rooms full of builders.', glyph: '◇' },
  { title: 'Ethical AI', body: 'Using technology to drive positive, responsible change.', glyph: '◐' },
]

export const languages = [
  { name: 'English', level: 'Professional' },
  { name: 'Urdu', level: 'Native' },
]

export const SECTIONS = ['Intro', 'Manifesto', 'Journey', 'Ventures', 'Notes', 'Stack', 'Agents', 'Learning', 'Beyond', 'Contact']
