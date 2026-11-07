/**
 * Makes text read naturally by TTS: clock times, common symbols, ranges.
 * Language-aware for the languages we ship; falls back to safe generic rules.
 */
const H = {
  hour: (h: number) => `${h} बजकर`, hourOnly: (h: number) => `${h} बजे`, minute: (m: number) => `${m} मिनट`,
};

function timeToSpeech(h: number, m: number, lang: string): string {
  const l = lang.toLowerCase();
  if (l.startsWith("hindi") || l.startsWith("hi")) return m === 0 ? H.hourOnly(h) : `${H.hour(h)} ${H.minute(m)}`;
  if (l.startsWith("punjabi") || l.startsWith("pa")) return m === 0 ? `${h} ਵਜੇ` : `${h} ਵਜ ਕੇ ${m} ਮਿੰਟ`;
  if (l.startsWith("spanish") || l.startsWith("es")) return m === 0 ? `las ${h} en punto` : `las ${h} y ${m}`;
  if (l.startsWith("french") || l.startsWith("fr")) return m === 0 ? `${h} heures` : `${h} heures ${m}`;
  if (l.startsWith("german") || l.startsWith("de")) return m === 0 ? `${h} Uhr` : `${h} Uhr ${m}`;
  if (l.startsWith("portuguese") || l.startsWith("pt")) return m === 0 ? `${h} horas` : `${h} e ${m}`;
  // English and default: "2:17" → "2 17" reads as "two seventeen"; "2:00" → "2 o'clock"
  return m === 0 ? `${h} o'clock` : `${h} ${String(m).padStart(2, "0")}`;
}

const HI_ONES = ["शून्य","एक","दो","तीन","चार","पाँच","छह","सात","आठ","नौ","दस","ग्यारह","बारह","तेरह","चौदह","पंद्रह","सोलह","सत्रह","अठारह","उन्नीस",
  "बीस","इक्कीस","बाईस","तेईस","चौबीस","पच्चीस","छब्बीस","सत्ताईस","अट्ठाईस","उनतीस","तीस","इकतीस","बत्तीस","तैंतीस","चौंतीस","पैंतीस","छत्तीस","सैंतीस","अड़तीस","उनतालीस",
  "चालीस","इकतालीस","बयालीस","तैंतालीस","चवालीस","पैंतालीस","छियालीस","सैंतालीस","अड़तालीस","उनचास","पचास","इक्यावन","बावन","तिरपन","चौवन","पचपन","छप्पन","सत्तावन","अट्ठावन","उनसठ",
  "साठ","इकसठ","बासठ","तिरसठ","चौंसठ","पैंसठ","छियासठ","सड़सठ","अड़सठ","उनहत्तर","सत्तर","इकहत्तर","बहत्तर","तिहत्तर","चौहत्तर","पचहत्तर","छिहत्तर","सतहत्तर","अठहत्तर","उनासी",
  "अस्सी","इक्यासी","बयासी","तिरासी","चौरासी","पचासी","छियासी","सत्तासी","अट्ठासी","नवासी","नब्बे","इक्यानवे","बानवे","तिरानवे","चौरानवे","पचानवे","छियानवे","सत्तानवे","अट्ठानवे","निन्यानवे"];

/** 0 – 99,99,99,999 in Hindi words, with a natural reading for years (1974 → उन्नीस सौ चौहत्तर, 2008 → दो हज़ार आठ). */
export function hindiNumberWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  if (n < 100) return HI_ONES[n];
  if (n >= 1100 && n <= 1999) { const lo = n % 100; return `${HI_ONES[Math.floor(n / 100)]} सौ${lo ? " " + HI_ONES[lo] : ""}`; }
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), thousand = Math.floor((n % 1e5) / 1000), hundred = Math.floor((n % 1000) / 100), rest = n % 100;
  if (crore) parts.push(`${HI_ONES[crore] ?? crore} करोड़`);
  if (lakh) parts.push(`${HI_ONES[lakh]} लाख`);
  if (thousand) parts.push(`${HI_ONES[thousand]} हज़ार`);
  if (hundred) parts.push(`${HI_ONES[hundred]} सौ`);
  if (rest) parts.push(HI_ONES[rest]);
  return parts.join(" ");
}

export function normalizeForSpeech(text: string, language: string): string {
  let t = text;
  const hindi = /hindi|^hi\b/i.test(language);
  if (hindi) {
    // digits are read in English by most Hindi voices — write them out in Hindi so the narration never switches language mid-sentence
    t = t.replace(/₹\s*([\d,]+)/g, (_m, d) => `${d} रुपये`);
  }
  // clock times: 2:17, 02:17, 2:17 AM, 14:05
  // (a trailing "बजे"/"o'clock" already in the text is absorbed so it isn't spoken twice)
  t = t.replace(/\b(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?(?:\s*(?:बजे|o'clock))?/g, (_m, h, mm, ap) => {
    const hour = Number(h), min = Number(mm);
    if (hour > 24 || min > 59) return _m;
    const spoken = timeToSpeech(hour, min, language);
    return (ap ? `${spoken} ${ap.toUpperCase()}` : spoken) + " ";
  });
  // Hindi: every remaining number in words (years read naturally: 1974 → उन्नीस सौ चौहत्तर)
  if (hindi) t = t.replace(/\b(\d{1,3}(?:,\d{2,3})+|\d+)\b/g, (m) => hindiNumberWords(Number(m.replace(/,/g, ""))));
  // ranges and symbols that TTS engines mangle
  t = t.replace(/(\d)\s*[–-]\s*(\d)/g, (m, a, b) => (/hindi|hi/i.test(language) ? `${a} से ${b}` : `${a} to ${b}`));
  t = t.replace(/%/g, /hindi|hi/i.test(language) ? " प्रतिशत" : " percent");
  t = t.replace(/&/g, /hindi|hi/i.test(language) ? " और " : " and ");
  t = t.replace(/\s{2,}/g, " ").trim();
  return t;
}
