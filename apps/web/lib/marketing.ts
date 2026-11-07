/**
 * Homepage content. Everything editable lives here so copy/claims can change without touching components.
 * `verified: false` items are demo content from the design concept and are NOT rendered in production.
 */

export const nav = [
  { label: "Product", href: "#product" }, { label: "Solutions", href: "#system" }, { label: "Examples", href: "#templates" },
  { label: "Monetization", href: "#roadmap" }, { label: "Tutorials", href: "#academy" }, { label: "Pricing", href: "#pricing" },
];

export const hero = {
  eyebrow: "AI video studio + YouTube growth system",
  lines: ["Create videos.", "Build your channel.", "Reach monetization."],
  sub: "Turn any idea into a complete, publish-ready YouTube video — script, visuals, voiceover, captions, thumbnail, SEO and more. Then publish it and build toward monetization from one workspace.",
  primary: "Create your first video", secondary: "Watch 90-sec demo", demoUrl: "#product",
  benefits: ["No camera needed", "All-in-one creator workspace", "Built for YouTube & Shorts", "Ready to publish"],
};

/** Social-proof metrics. Unverified numbers stay hidden; replace with real ones when you have them. */
export const metrics = {
  verified: false,
  items: [["10,000+", "Creators"], ["1M+", "Videos created"], ["120+", "Countries"], ["4.9/5", "Average rating"]],
};

export const outputs = {
  left: [["Script", "Complete"], ["Visuals", "42 scenes"], ["Voiceover", "AI voice"], ["Music", "Royalty-free"], ["Captions", "Stylish subtitles"]],
  right: [["Thumbnails", "3 variants"], ["SEO package", "Titles, description, tags"], ["Chapters", "Auto timestamps"], ["Publish ready", "YouTube optimized"]],
};

export const pillars = [
  { id: "create", title: "Create", live: true, headline: "Complete AI videos, in minutes.", items: ["Script + visuals + voiceover", "Captions + music + thumbnails", "28 video formats & 21 styles", "Built for YouTube & Shorts"], cta: "Create a video" },
  { id: "publish", title: "Publish", live: true, headline: "Upload-ready, in one click.", items: ["SEO titles, description, chapters", "Tags & hashtags", "Thumbnail hook editor", "Schedule or upload to YouTube"], cta: "See the publish kit" },
  { id: "grow", title: "Grow", live: false, headline: "Know what to make next.", items: ["Channel analytics", "Content performance", "Audience insights", "AI recommendations"], cta: "Coming soon" },
  { id: "monetize", title: "Monetize", live: false, headline: "Build toward monetization.", items: ["Monetization roadmap", "Eligibility tracking", "Policy readiness", "Growth milestones"], cta: "Coming soon" },
];

export const roadmap = [
  { n: "01", title: "Launch", sub: "Plan your channel with AI", live: false },
  { n: "02", title: "Create", sub: "Generate amazing videos", live: true },
  { n: "03", title: "Publish", sub: "Everything ready to go", live: true },
  { n: "04", title: "Grow", sub: "Track performance & get insights", live: false },
  { n: "05", title: "Monetize", sub: "Track your monetization progress", live: false },
];

/** Demo creator stories from the concept art — names, faces and numbers are placeholders. Hidden until `verified`. */
export const creatorStories = {
  verified: false,
  items: [
    { name: "Alex Carter", niche: "Tech & AI", quote: "Y2ube helped me go from zero to 100K subscribers in just 6 months!", subs: "124K", views: "3.4M", },
    { name: "Priya Sharma", niche: "Education", quote: "I create high-quality educational videos in a fraction of the time.", subs: "210K", views: "8.1M", },
    { name: "Mike Johnson", niche: "Travel", quote: "The videos look professional and my channel is growing fast!", subs: "87K", views: "2.9M", },
  ],
};

export const templateCards = [
  { id: "YouTube Documentary", name: "Documentary", sub: "Deep dives into amazing topics", key: "documentary", tag: "Documentary" },
  { id: "Explainer", name: "Explainer", sub: "Simplify complex ideas", key: "explainer", tag: "Educational" },
  { id: "Top 10", name: "Top 10", sub: "List videos that perform", key: "top10", tag: "Educational" },
  { id: "Finance", name: "Finance", sub: "Money, investing, business", key: "finance", tag: "Finance" },
  { id: "Tech Review", name: "Tech Review", sub: "Gadgets and software", key: "tech", tag: "Tech" },
  { id: "Kids Story", name: "Kids Story", sub: "Fun & engaging stories", key: "kids", tag: "Kids" },
  { id: "Motivational", name: "Motivation", sub: "Speeches with epic visuals", key: "motivation", tag: "Motivation" },
  { id: "Travel", name: "Travel", sub: "Guides and itineraries", key: "travel", tag: "Travel" },
  { id: "Horror Story", name: "Horror", sub: "Atmospheric fear, built slowly", key: "horror", tag: "Story" },
  { id: "Real Estate", name: "Real Estate", sub: "Property walkthroughs", key: "realestate", tag: "Business" },
  { id: "Short", name: "Shorts", sub: "Hook in one second", key: "shorts", tag: "Shorts" },
  { id: "Spokesperson Ad", name: "Ad / Promo", sub: "AI presenter with banners", key: "ads", tag: "Ads" },
];
export const templateFilters = ["All", "Documentary", "Educational", "Finance", "Tech", "Motivation", "Kids", "Travel", "Story", "Business", "Shorts", "Ads"];

export const academy = {
  available: false,
  items: [
    { n: "01", title: "Choose a profitable channel direction", mins: "2:24" }, { n: "02", title: "Create your first video", mins: "10:17" }, { n: "03", title: "Make thumbnails people click", mins: "6:24" },
    { n: "04", title: "Publish correctly on YouTube", mins: "7:15" }, { n: "05", title: "Understand watch time & retention", mins: "9:21" }, { n: "06", title: "Prepare for monetization", mins: "8:46" },
  ],
};

export const features = [
  { icon: "FileText", title: "AI Script Writer", sub: "Engaging scripts for any topic, in 10 languages" },
  { icon: "Image", title: "AI Visuals", sub: "Stock, AI images & AI video" },
  { icon: "Mic", title: "Natural Voiceover", sub: "Human-like AI voices, per-character voices" },
  { icon: "Captions", title: "Stylish Captions", sub: "7 caption styles, Hindi & Punjabi ready" },
  { icon: "Image", title: "Thumbnail Generator", sub: "Click-worthy hooks with a highlighted word" },
  { icon: "Search", title: "SEO Optimization", sub: "Titles, tags, description with chapters" },
  { icon: "Youtube", title: "Direct YouTube Upload", sub: "Publish or schedule from the result page" },
  { icon: "BarChart3", title: "Analytics & Insights", sub: "Coming soon", soon: true },
];

export const faqs = [
  ["What is Y2ube?", "Y2ube turns a prompt or a finished script into a complete YouTube video — script, visuals, voiceover, music, captions, thumbnails and an SEO package — and can publish it to your channel."],
  ["Do I need video editing skills?", "No. You describe the video; Y2ube writes, plans, generates and renders it. A scene editor lets you swap a shot or re-voice a paragraph without any editing software."],
  ["Can I upload directly to YouTube?", "Yes. Connect your channel once, then publish or schedule from the result page with title, description, tags and thumbnail filled in."],
  ["What languages are supported?", "English, Hindi, Punjabi, Spanish, French, German, Portuguese, Arabic, Japanese and Italian — including native-script captions and thumbnails."],
  ["Can Y2ube make Shorts?", "Yes. Choose the 9:16 format and a short-form type; pacing, captions and hooks are tuned for Shorts and Reels."],
  ["Can I create faceless videos?", "Yes — stock footage, AI images, or AI video clips; you never need a camera. Spokesperson ads with an AI presenter are also available."],
  ["Does Y2ube generate thumbnails?", "Every video gets three thumbnail variants, and a hook editor lets you change the text, highlight a word and re-render instantly."],
  ["How does monetization tracking work?", "The monetization roadmap is on our roadmap and not live yet; today Y2ube covers creation and publishing. We never promise or guarantee monetization."],
  ["Can I use videos commercially?", "Yes, subject to the terms of the stock and AI providers used. See our Terms for details."],
];

export const footer = {
  tagline: "Create. Grow. Monetize.",
  blurb: "The all-in-one AI video studio for YouTube creators, built for a new generation of storytellers.",
  columns: [
    { title: "Product", links: [["Features", "#product"], ["Templates", "#templates"], ["Pricing", "#pricing"], ["API", "/settings/api"]] },
    { title: "Resources", links: [["Tutorials", "#academy"], ["Creator stories", "#stories"], ["Help", "mailto:support@y2ube.io"]] },
    { title: "Company", links: [["Contact", "mailto:support@y2ube.io"]] },
    { title: "Legal", links: [["Terms", "/terms"], ["Privacy", "/privacy"], ["Refunds", "/refunds"]] },
  ],
};
