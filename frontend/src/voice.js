// Browser speech: free, no API key. Works best in Chrome or Edge. Voice quality depends on the device.
const MAP = { en: "en-IN", hi: "hi-IN", bn: "bn-IN", mr: "mr-IN", te: "te-IN", ta: "ta-IN", gu: "gu-IN", ur: "ur-IN", kn: "kn-IN", or: "or-IN", ml: "ml-IN", pa: "pa-IN", as: "as-IN", ne: "ne-NP", sd: "sd-IN", kok: "kok-IN", sa: "sa-IN", mai: "mai-IN", doi: "doi-IN" };
const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
export const sttSupported = () => !!SR();
export function listen(lang, { onResult, onEnd, onError }) {
  const r = new (SR())(); r.lang = MAP[lang] || "en-IN"; r.interimResults = true; r.continuous = false;
  r.onresult = e => onResult([...e.results].map(x => x[0].transcript).join(""), e.results[e.results.length - 1].isFinal);
  r.onerror = e => onError && onError(e.error); r.onend = () => onEnd && onEnd(); r.start(); return r;
}
function voiceFor(code) {
  const base = code.slice(0, 2).toLowerCase(), vs = window.speechSynthesis.getVoices();
  return vs.find(v => v.lang.toLowerCase().replace("_", "-") === code.toLowerCase()) || vs.find(v => v.lang.toLowerCase().startsWith(base));
}
export function speak(text, lang) {
  const s = window.speechSynthesis; if (!s) return "unsupported";
  const code = MAP[lang] || "en-IN", v = voiceFor(code); if (!v && !code.startsWith("en")) return "novoice";
  s.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = code; if (v) u.voice = v; s.speak(u); return "ok";
}
export const stopSpeaking = () => window.speechSynthesis && window.speechSynthesis.cancel();
