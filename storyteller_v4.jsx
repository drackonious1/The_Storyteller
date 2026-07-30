import { useState, useRef, useEffect } from "react";
import {
  supabase, fetchProfile, fetchTodayUsage, bumpUsage, redeemPromo,
  fetchStories, upsertStory, guestCount, setGuestCount,
} from "./supabaseClient.js";

const FIREFLIES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: (i * 43.7 + 11) % 98,
  top:  (i * 27.3 + 5)  % 88,
  size: i % 5 === 0 ? 4 : i % 3 === 0 ? 3 : 2,
  dur:  3 + (i % 6),
  delay: -(i * 0.9) % 7,
  drift: (i % 2 === 0 ? 1 : -1) * (4 + (i % 5)),
}));

const MODES = {
  kids: {
    primary: "#FFB800", glow: "rgba(255,184,0,0.55)", subtle: "rgba(255,184,0,0.12)",
    text: "#FFE090", bg: "#2e1800", border: "rgba(255,184,0,0.4)",
    teller: "The Gentle Dreamer", sub: "✨ warm tales for young hearts ✨",
    badge: "Young Hearts", btnLabel: "✨  Begin the Adventure  ✨",
    contLabel: "✨  Continue the Adventure  ✨",
    orbA: "#FFD700", orbB: "#C87000", orbC: "#3A1F00",
    landingText: "The Gentle Dreamer is ready to take you on a wonderful, magical adventure...",
    loadingText: "✨ weaving your adventure... ✨",
  },
  older: {
    primary: "#7B2FFF", glow: "rgba(123,47,255,0.55)", subtle: "rgba(123,47,255,0.12)",
    text: "#D4B0FF", bg: "#1a0f35", border: "rgba(123,47,255,0.4)",
    teller: "The Ancient Whisperer", sub: "✦ tales from the edge of worlds ✦",
    badge: "Mystic", btnLabel: "✦  Awaken the Story  ✦",
    contLabel: "✦  Weave the Tale Further  ✦",
    orbA: "#9a5cda", orbB: "#4a1590", orbC: "#160835",
    landingText: "An ancient voice stirs at the boundary of worlds, ready to share what it witnesses...",
    loadingText: "✦ the ancient voice stirs... ✦",
  },
  family: {
    primary: "#00D98B", glow: "rgba(0,217,139,0.55)", subtle: "rgba(0,217,139,0.12)",
    text: "#90FFD8", bg: "#0f2a1a", border: "rgba(0,217,139,0.4)",
    teller: "The Hearthkeeper", sub: "🌿 stories of family, bond and belonging 🌿",
    badge: "Family", btnLabel: "🌿  Begin the Family Tale  🌿",
    contLabel: "🌿  Continue the Journey  🌿",
    orbA: "#00D98B", orbB: "#006644", orbC: "#001A0F",
    landingText: "The Hearthkeeper tends the fire of family stories, ready to weave a tale of belonging...",
    loadingText: "🌿 the hearthkeeper weaves your tale... 🌿",
  },
};

const SYSTEMS = {
  kids: `You are the Gentle Dreamer — a warm magical storyteller in a world filled with friendly creatures, sparkling forests, rainbow waterfalls, and incredible adventures. Your stories are joyful, wondrous, and completely safe. Characters are kind and brave. Adventures always end with warmth and hope. Use simple vivid language, 3 short paragraphs. End on an exciting moment that makes young hearts want more. Never scary, always gentle.`,
  older: `You are the Ancient Whisperer — an immortal entity at the boundary of worlds. Your realm has moonlit forests breathing silver mist, crystal lakes reflecting futures, floating ruins humming with forgotten spells, storms that speak, creatures of impossible wonder. Tell stories as if living them. Rich, detailed, layered narrative — atmospheric, immersive, like a dream spoken aloud. 4 to 5 paragraphs, deep world-building, complex characters with real motivations. End on a moment of haunting beauty or intrigue. Never break character.`,
  family: `You are the Hearthkeeper — an ancient storyteller who tends the eternal fire where all family stories are born. You tell mystical fantasy tales centred on family groups: parents and children, siblings, chosen families, clans, a grandmother and her grandchildren, a village raising a child, brothers on a quest. Themes of love, sacrifice, belonging, protecting those you cherish, finding your way home to each other. Your world is mystical and magical but grounded in the warmth of family bonds. 3 to 4 paragraphs. Real emotion, real stakes, real heart. End on a moment that celebrates the bond between the characters.`,
};

const TIERS = {
  free:     { name: "Free",     price: "$0",  period: "",       stories: 3,  daily: false },
  standard: { name: "Standard", price: "$10", period: "/month", stories: 1,  daily: true  },
  full:     { name: "Full",     price: "$25", period: "/month", stories: 3,  daily: true  },
};

const PROMO_CODES = {
  "DRACKO":    { tier: "full",     msg: "Welcome home, creator ✦ Full realm unlocked!" },
  "DRACKO25":  { tier: "full",     msg: "Welcome home, creator ✦ Full realm unlocked!" },
  "BETA10":    { tier: "standard", msg: "Beta access granted ✦ Standard unlocked!" },
  "BETA25":    { tier: "full",     msg: "Beta access granted ✦ Full realm unlocked!" },
};

const TIER_PERKS = {
  free:     ["3 stories total to explore the realm", "All three story modes", "No account needed"],
  standard: ["1 new story per mode per day", "Save up to 20 tales", "Continue any story anytime", "All three story modes"],
  full:     ["3 new stories per mode per day", "Save up to 20 tales", "Continue any story anytime", "All three story modes", "Priority story generation"],
};

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #05030d; min-height: 100vh; }
.app { background: var(--bg, #070412); height: 100vh; height: 100dvh; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; border-radius: 0; overflow: clip; font-family: Georgia,'Book Antiqua',Palatino,serif; color: var(--mt, #C4A0FF); transition: background 0.6s ease; position: relative; }
.app::before { content: ''; position: absolute; inset: -40%; z-index: 0; pointer-events: none; opacity: 0.12; filter: blur(45px); background: radial-gradient(38% 30% at 28% 24%, var(--mg) 0%, transparent 62%), radial-gradient(34% 26% at 74% 72%, var(--mg) 0%, transparent 62%); animation: auroradrift 28s ease-in-out infinite alternate; }
@keyframes auroradrift { 0% { transform: translate(-4%, -3%) rotate(0deg) scale(1); } 50% { transform: translate(5%, 4%) rotate(7deg) scale(1.12); } 100% { transform: translate(-2%, 6%) rotate(-5deg) scale(1.06); } }
.app-story { height: 100vh; height: 100dvh; min-height: 0; }
.app-story .screen { min-height: 0; }
.app-story .controls { flex-shrink: 0; }
.screen { display: flex; flex-direction: column; flex: 1; min-height: 0; animation: fadein 0.45s ease; }
@keyframes fadein { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.ff { position: absolute; border-radius: 50%; background: var(--mp, #7B2FFF); box-shadow: 0 0 6px 2px var(--mg, rgba(123,47,255,0.55)); animation: ffloat var(--fd) ease-in-out infinite var(--fdl), fftw var(--ftw) ease-in-out infinite; pointer-events: none; z-index: 0; }
@keyframes fftw { 0%,100%{opacity:0.1} 40%{opacity:0.85} 60%{opacity:0.95} }
@keyframes ffloat { 0%,100%{transform:translateY(0px) translateX(0px)} 50%{transform:translateY(var(--fy,-8px)) translateX(var(--fx,5px))} }
.orb-wrap { position: relative; width: 110px; height: 110px; display: flex; align-items: center; justify-content: center; }
.orb { border-radius: 50%; animation: orbpulse 3.5s ease-in-out infinite; }
.orb-ring { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid var(--mg); animation: orbring 3.5s ease-in-out infinite; }
.orb-ring2 { position: absolute; inset: -10px; border-radius: 50%; border: 1px solid var(--mg); animation: orbring 3.5s ease-in-out infinite 0.4s; }
@keyframes orbpulse { 0%,100%{transform:scale(1);box-shadow:0 0 24px 4px var(--mg),0 0 60px 10px var(--ms)} 50%{transform:scale(1.08);box-shadow:0 0 40px 8px var(--mg),0 0 90px 18px var(--ms)} }
@keyframes orbring { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.3);opacity:0.08} }
.crystal-div { text-align: center; color: var(--mp); letter-spacing: 8px; font-size: 14px; margin: 18px 0 22px; filter: drop-shadow(0 0 6px var(--mp)); }
.glow-title { font-size: 20px; letter-spacing: 3px; text-transform: uppercase; color: var(--mp); text-shadow: 0 0 12px var(--mg), 0 0 28px var(--ms); }
.glow-sub { font-size: 12px; font-style: italic; color: var(--mt); opacity: 0.7; letter-spacing: 1px; }
.btn-glow { background: linear-gradient(135deg, rgba(0,0,0,0.4), var(--ms)); border: 1.5px solid var(--mp); box-shadow: 0 0 14px var(--mg), inset 0 0 10px var(--ms); color: var(--mt); padding: 14px 20px; border-radius: 12px; font-family: Georgia,serif; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; transition: all 0.25s; width: 100%; text-shadow: 0 0 8px var(--mg); }
.btn-glow:hover:not(:disabled) { box-shadow: 0 0 24px var(--mg), 0 0 50px var(--ms), inset 0 0 16px var(--ms); transform: translateY(-2px); }
.btn-glow:disabled { opacity: 0.3; cursor: not-allowed; }
.btn-outline-glow { background: transparent; border: 1px solid var(--border); color: var(--mt); opacity: 0.7; padding: 12px 20px; border-radius: 12px; font-family: Georgia,serif; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; transition: all 0.25s; width: 100%; }
.btn-outline-glow:hover { border-color: var(--mp); box-shadow: 0 0 12px var(--ms); opacity: 1; }
.btn-ghost { background: none; border: none; color: var(--mt); opacity: 0.45; font-family: Georgia,serif; font-size: 12px; cursor: pointer; padding: 0; letter-spacing: 1px; transition: all 0.2s; }
.btn-ghost:hover { opacity: 0.9; text-shadow: 0 0 8px var(--mg); }
.btn-sm { flex: 1; background: var(--ms); border: 1px solid var(--border); color: var(--mt); padding: 10px 8px; border-radius: 10px; font-family: Georgia,serif; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
.btn-sm:hover:not(:disabled) { box-shadow: 0 0 10px var(--ms); border-color: var(--mp); }
.btn-sm:disabled { opacity: 0.25; cursor: not-allowed; }
.splash { align-items: center; justify-content: center; min-height: 640px; padding: 36px 24px; gap: 18px; text-align: center; position: relative; overflow: hidden; z-index: 1; }
.splash-body { font-size: 14px; font-style: italic; line-height: 1.75; max-width: 280px; color: var(--mt); opacity: 0.6; }
.splash-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 300px; }
.splash-note { font-size: 11px; color: var(--mt); opacity: 0.3; font-style: italic; }
.mode-sel { display: flex; gap: 6px; padding: 0 18px; margin-top: 10px; }
.mode-btn { flex: 1; padding: 8px 4px; border-radius: 10px; font-family: Georgia,serif; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.3s; border: 1px solid transparent; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.35); }
.mode-btn.active { border-color: var(--mp); background: var(--ms); color: var(--mt); box-shadow: 0 0 12px var(--ms); text-shadow: 0 0 8px var(--mg); }
.mode-btn:hover:not(.active) { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); }
.auth-wrap { flex: 1; padding: 22px 22px; display: flex; flex-direction: column; gap: 14px; position: relative; z-index: 1; }
.auth-tabs { display: flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.auth-tab { flex: 1; padding: 10px; background: none; border: none; color: var(--mt); opacity: 0.45; font-family: Georgia,serif; font-size: 12px; cursor: pointer; letter-spacing: 1.5px; text-transform: uppercase; transition: all 0.2s; }
.auth-tab.active { background: var(--ms); opacity: 1; box-shadow: inset 0 0 12px var(--ms); }
.field { display: flex; flex-direction: column; gap: 5px; }
.field label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--mt); opacity: 0.5; }
.field input { background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 8px; padding: 11px 13px; color: var(--mt); font-family: Georgia,serif; font-size: 14px; outline: none; transition: all 0.2s; }
.field input:focus { border-color: var(--mp); box-shadow: 0 0 10px var(--ms); }
.field input::placeholder { color: var(--mt); opacity: 0.2; }
.msg-err { color: #ff7a7a; font-size: 12px; font-style: italic; text-align: center; }
.msg-ok { color: #7FFFCF; font-size: 12px; font-style: italic; text-align: center; }
.hdr { position: relative; padding: 16px 18px 10px; text-align: center; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%); overflow: hidden; z-index: 2; }
.hdr::after { content: ''; position: absolute; bottom: 0; left: 10%; right: 10%; height: 1px; background: linear-gradient(90deg, transparent, var(--mp), transparent); opacity: 0.6; }
.hdr-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.hdr-user { font-size: 11px; color: var(--mt); opacity: 0.5; font-style: italic; }
.mute-btn { background: var(--ms); border: 1px solid var(--border); color: var(--mt); padding: 4px 10px; border-radius: 20px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
.mute-btn:hover { box-shadow: 0 0 8px var(--ms); }
.usage-wrap { padding: 8px 18px 4px; position: relative; z-index: 1; }
.usage-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
.usage-lbl { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--mt); opacity: 0.35; }
.usage-val { font-size: 10px; color: var(--mt); opacity: 0.5; }
.usage-track { height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
.usage-fill { height: 100%; background: var(--mp); border-radius: 2px; transition: width 0.6s; box-shadow: 0 0 6px var(--mg); }
.upgrade-nudge { font-size: 10px; color: var(--mp); text-align: right; margin-top: 4px; cursor: pointer; opacity: 0.8; }
.upgrade-nudge:hover { opacity: 1; text-shadow: 0 0 8px var(--mg); }
.home-body { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 18px; position: relative; z-index: 1; }
.section-lbl { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--mt); opacity: 0.3; margin-bottom: 10px; margin-top: 4px; }
.story-card { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 13px 15px; margin-bottom: 10px; cursor: pointer; transition: all 0.25s; }
.story-card:hover { border-color: var(--mp); box-shadow: 0 0 16px var(--ms); background: var(--ms); }
.card-title { font-size: 14px; color: var(--mt); margin-bottom: 3px; }
.card-preview { font-size: 12px; color: var(--mt); opacity: 0.45; font-style: italic; margin-top: 5px; line-height: 1.5; }
.card-meta { font-size: 10px; color: var(--mt); opacity: 0.28; margin-top: 4px; }
.badge { display: inline-block; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; margin-bottom: 5px; border: 1px solid var(--border); background: var(--ms); color: var(--mp); box-shadow: 0 0 6px var(--ms); }
.empty { text-align: center; padding: 32px 20px; font-style: italic; color: var(--mt); opacity: 0.28; font-size: 13px; line-height: 1.8; }
.story-scroll { flex: 1; overflow-y: auto; min-height: 0; scrollbar-width: thin; scrollbar-color: var(--mp) transparent; position: relative; z-index: 1; }
.story-scroll::-webkit-scrollbar { width: 3px; }
.story-scroll::-webkit-scrollbar-thumb { background: var(--mp); border-radius: 2px; }
.story-landing { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 340px; padding: 30px 24px; gap: 18px; text-align: center; }
.story-landing-text { font-size: 14px; font-style: italic; color: var(--mt); opacity: 0.55; line-height: 1.75; max-width: 270px; }
.story-inner { padding: 20px 20px 6px; }
.chunk { animation: fadein 0.9s ease; }
.para { font-size: 20px; line-height: 2.1; color: var(--mt); margin-bottom: 22px; opacity: 1; font-weight: bold; }
.voice-bar { display: flex; align-items: center; gap: 8px; padding: 10px 0 0; flex-wrap: wrap; }
.voice-btn { background: var(--ms); border: 1px solid var(--border); color: var(--mt); padding: 8px 14px; border-radius: 20px; font-family: Georgia,serif; font-size: 12px; letter-spacing: 1px; cursor: pointer; transition: all 0.2s; }
.voice-select { background: var(--ms); border: 1px solid var(--border); color: var(--mt); padding: 8px 10px; border-radius: 20px; font-family: Georgia,serif; font-size: 12px; cursor: pointer; outline: none; }
.voice-select option { background: #1a0f25; color: var(--mt); }
.voice-btn:hover { box-shadow: 0 0 10px var(--ms); border-color: var(--mp); }
.voice-btn.speaking { border-color: var(--mp); box-shadow: 0 0 14px var(--mg); animation: shimmer 1.5s ease-in-out infinite; }
.voice-note { font-size: 10px; color: var(--mt); opacity: 0.4; font-style: italic; width: 100%; }
.loading-p { text-align: center; padding: 26px 20px; font-style: italic; font-size: 13px; color: var(--mp); animation: shimmer 1.8s ease-in-out infinite; letter-spacing: 1px; text-shadow: 0 0 10px var(--mg); }
@keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:1} }
.scroll-end { height: 14px; }
.controls { padding: 10px 18px 18px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--border); background: rgba(0,0,0,0.6); position: relative; z-index: 2; }
.controls::before { content: ''; position: absolute; top: 0; left: 10%; right: 10%; height: 1px; background: linear-gradient(90deg, transparent, var(--mp), transparent); opacity: 0.4; }
.btn-row { display: flex; gap: 7px; }
.save-msg { text-align: center; font-size: 11px; font-style: italic; color: #7FFFCF; letter-spacing: 1px; animation: fadein 0.4s ease; }
.pricing-wrap { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 18px; position: relative; z-index: 1; }
.tier-card { border-radius: 14px; padding: 16px; margin-bottom: 12px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); }
.tier-card.featured { border-color: var(--mp); background: var(--ms); box-shadow: 0 0 20px var(--ms); }
.tier-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.tier-name { font-size: 14px; letter-spacing: 2px; text-transform: uppercase; color: var(--mp); }
.tier-price { font-size: 20px; color: var(--mt); }
.tier-price span { font-size: 11px; opacity: 0.5; }
.tier-perks { list-style: none; display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.tier-perks li { font-size: 12px; color: var(--mt); opacity: 0.65; font-style: italic; }
.tier-perks li::before { content: "✦  "; color: var(--mp); }
.tier-tag { display: inline-block; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; background: var(--ms); color: var(--mp); border: 1px solid var(--border); margin-bottom: 8px; }
.limit-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; gap: 18px; text-align: center; position: relative; z-index: 1; }
.limit-title { font-size: 17px; letter-spacing: 2px; color: var(--mp); text-transform: uppercase; text-shadow: 0 0 16px var(--mg); }
.limit-body { font-size: 14px; color: var(--mt); opacity: 0.55; font-style: italic; line-height: 1.75; max-width: 280px; }
`;

function storageGet(k) { try { const v = localStorage.getItem(k); return Promise.resolve(v ? JSON.parse(v) : null); } catch(e) { return Promise.resolve(null); } }
function storageSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return Promise.resolve(true); } catch(e) { return Promise.resolve(null); } }
function todayKey() { return new Date().toISOString().slice(0, 10); }

export default function App() {
  const [screen, setScreen] = useState("splash");
  const [authTab, setAuthTab] = useState("login");
  const [uname, setUname] = useState("");
  const [pwd, setPwd] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authOk, setAuthOk] = useState("");
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [tier, setTier] = useState("free");
  const [mode, setMode] = useState("older");
  const [stories, setStories] = useState([]);
  const [activeStory, setActiveStory] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [usedToday, setUsedToday] = useState({ kids: 0, older: 0, family: 0 });
  const [usedTotal, setUsedTotal] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [promoMsg, setPromoMsg] = useState("");
  const [promoErr, setPromoErr] = useState("");
  // Voice choices: browser Aussie voices (free, unlimited, works in every browser)
  const VOICES = [
    { id: 'female', name: 'Aussie Female' },
    { id: 'male',   name: 'Aussie Male' },
  ];
  const [selectedVoice, setSelectedVoice] = useState('female');
  const [speaking, setSpeaking] = useState(false);
  const [voicePrep, setVoicePrep] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voices, setVoices] = useState([]);
  const audioRef = useRef(null);
  const endRef = useRef(null);
  const speakingRef = useRef(false);
  const scrollModeRef = useRef('bottom');

  // Restore an existing login when the page loads or is refreshed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data && data.session) {
        const uid = data.session.user.id;
        setUserId(uid);
        const profile = await fetchProfile(uid);
        if (cancelled) return;
        setUser((profile && profile.username) || data.session.user.email.split("@")[0]);
        setTier((profile && profile.tier) || "free");
        setUsedToday(await fetchTodayUsage(uid));
        setStories(await fetchStories(uid));
        setScreen("home");
      } else {
        setUsedTotal(guestCount());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const audio = new Audio('https://res.cloudinary.com/dyjvf7ezd/video/upload/App_backgroup_mwkxfb.m4a');
    audio.loop = true;
    audio.volume = 0.25;
    audioRef.current = audio;
    const startAudio = () => { audio.play().catch(() => {}); document.removeEventListener('click', startAudio); };
    document.addEventListener('click', startAudio);
    return () => { audio.pause(); audio.src = ''; document.removeEventListener('click', startAudio); };
  }, []);

  useEffect(() => {
    const loadVoices = () => { const v = window.speechSynthesis.getVoices(); if (v.length > 0) setVoices(v); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (scrollModeRef.current === 'top') {
      const el = document.querySelector('.story-scroll');
      if (el) el.scrollTop = 0;
    } else {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chunks, loading]);

  const m = MODES[mode];
  const cssVars = { "--mp": m.primary, "--mg": m.glow, "--ms": m.subtle, "--mt": m.text, "--bg": m.bg, "--border": m.border };

  const loadUsage = async (uid) => {
    if (!uid) { setUsedTotal(guestCount()); return; }
    const profile = await fetchProfile(uid);
    setTier((profile && profile.tier) || "free");
    setUsedToday(await fetchTodayUsage(uid));
    setStories(await fetchStories(uid));
  };

  const allowance = () => {
    if (!user) return { ok: usedTotal < 3, rem: 3 - usedTotal, max: 3, label: `${Math.max(0, 3 - usedTotal)} of 3 total` };
    const t = TIERS[tier];
    if (!t.daily) return { ok: usedTotal < t.stories, rem: t.stories - usedTotal, max: t.stories, label: `${Math.max(0, t.stories - usedTotal)} of ${t.stories} total` };
    const modeCount = usedToday[mode] || 0;
    return { ok: modeCount < t.stories, rem: t.stories - modeCount, max: t.stories, label: `${Math.max(0, t.stories - modeCount)} of ${t.stories} today` };
  };

  const incUsage = async () => {
    if (!userId) { const n = usedTotal + 1; setUsedTotal(n); setGuestCount(n); }
    else {
      const n = (usedToday[mode] || 0) + 1;
      setUsedToday(prev => ({ ...prev, [mode]: n }));
      const server = await bumpUsage(mode);
      if (typeof server === "number") setUsedToday(prev => ({ ...prev, [mode]: server }));
    }
  };

  const enterRealm = async (session) => {
    const uid = session.user.id;
    setUserId(uid);
    const profile = await fetchProfile(uid);
    setUser((profile && profile.username) || session.user.email.split("@")[0]);
    setTier((profile && profile.tier) || "free");
    setUsedToday(await fetchTodayUsage(uid));
    setStories(await fetchStories(uid));
    setScreen("home");
  };

  const handleAuth = async () => {
    setAuthErr(""); setAuthOk("");
    const mail = email.trim().toLowerCase();
    const u = uname.trim().toLowerCase();
    if (!mail || !pwd) { setAuthErr("Please enter your email and password."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setAuthErr("That email does not look right."); return; }
    if (pwd.length < 6) { setAuthErr("Password must be at least 6 characters."); return; }

    setAuthBusy(true);
    try {
      if (authTab === "signup") {
        if (!u || u.length < 3) { setAuthErr("Realm name must be at least 3 characters."); setAuthBusy(false); return; }
        const { data, error } = await supabase.auth.signUp({
          email: mail, password: pwd, options: { data: { username: u } },
        });
        if (error) {
          setAuthErr(error.message.includes("already") ? "That email is already registered — try Login." : error.message);
          setAuthBusy(false); return;
        }
        if (data.session) {
          setAuthOk("Welcome to the realm!...");
          setTimeout(() => enterRealm(data.session), 1100);
        } else {
          setAuthOk("Check your email to confirm your account, then log in.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password: pwd });
        if (error) { setAuthErr("Incorrect email or password."); setAuthBusy(false); return; }
        await enterRealm(data.session);
      }
    } catch (e) {
      setAuthErr("Something went wrong. Please try again.");
    }
    setAuthBusy(false);
  };

  const handleGuest = async () => { await loadUsage(null); setScreen("home"); };

  const handlePromo = async () => {
    setPromoMsg(""); setPromoErr("");
    const code = promoCode.trim().toUpperCase();
    if (!code) { setPromoErr("Enter a code first."); return; }
    if (!userId) { setPromoErr("Create an account first to use a promo code."); return; }
    const newTier = await redeemPromo(code);
    if (!newTier) { setPromoErr("That code isn't valid. Try again!"); return; }
    setTier(newTier);
    setUsedToday({ kids: 0, older: 0, family: 0 });
    setPromoMsg(newTier === "full"
      ? "Welcome home, creator \u2726 Full realm unlocked!"
      : "Access granted \u2726 Standard unlocked!");
    setPromoCode("");
    setTimeout(() => { setPromoMsg(""); setScreen("home"); }, 2000);
  };

  const fadeOutMusic = () => {
    if (!audioRef.current) return;
    const fade = setInterval(() => {
      if (audioRef.current.volume > 0.02) { audioRef.current.volume = Math.max(0, audioRef.current.volume - 0.02); }
      else { audioRef.current.pause(); audioRef.current.volume = 0.25; clearInterval(fade); }
    }, 100);
  };

  const fadeInMusic = () => {
    if (!audioRef.current) return;
    audioRef.current.volume = 0;
    audioRef.current.play().catch(() => {});
    const fade = setInterval(() => {
      if (audioRef.current.volume < 0.23) { audioRef.current.volume = Math.min(0.25, audioRef.current.volume + 0.02); }
      else { clearInterval(fade); }
    }, 100);
  };

  const logout = async () => { await supabase.auth.signOut(); setUser(null); setUserId(null); setTier("free"); setStories([]); setUsedTotal(guestCount()); setUsedToday({ kids: 0, older: 0, family: 0 }); setScreen("splash"); setUname(""); setPwd(""); setEmail(""); };

  const stopVoice = () => {
    if (window._ttsAudio) {
      try {
        window._ttsAudio.pause();
        window._ttsAudio.onended = null;
        window._ttsAudio.onerror = null;
        window._ttsAudio.ontimeupdate = null;
        window._ttsAudio.currentTime = 0;
        if (window._ttsAudio.src && window._ttsAudio.src.indexOf('blob:') === 0) URL.revokeObjectURL(window._ttsAudio.src);
        window._ttsAudio.src = '';
      } catch (e) {}
      window._ttsAudio = null;
    }
    window._ttsCancelled = true;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    setSpeaking(false);
    setVoicePrep(false);
  };

  // Pick a browser voice for the chosen gender. Mobile pitch/rate tweaks are unreliable
  // (many mobile TTS voices are "non-local"/cloud and silently ignore pitch changes), so
  // instead of leaning on pitch we guarantee male vs female use two DIFFERENT underlying
  // voice objects whenever the device has more than one voice at all - that difference in
  // the actual voice engine is audible even when pitch is ignored.
  const pickAuVoice = (wantMale) => {
    const list = window.speechSynthesis.getVoices() || [];
    const femaleNames = /Natasha|Freya|Annette|Catherine|Hayley|Nicole|Olivia|Aria|Jenny|Zira|Karen|Samantha|female/i;
    const maleNames   = /William|Darren|Ken|James|Russell|Guy|Liam|Daniel|Alex|David|Mark|male/i;
    const au = list.filter(v => v.lang === 'en-AU' || /Australia/i.test(v.name));
    const en = list.filter(v => v.lang && v.lang.startsWith('en'));
    const wantNames = wantMale ? maleNames : femaleNames;

    // 1. Exact gender match within Australian voices.
    let pick = au.find(v => wantNames.test(v.name));
    if (pick) return { voice: pick, matchedGender: true };

    // 2. Exact gender match in any English voice.
    pick = en.find(v => wantNames.test(v.name));
    if (pick) return { voice: pick, matchedGender: true };

    // 3. Exact gender match in ANY voice on the device, any language.
    pick = list.find(v => wantNames.test(v.name));
    if (pick) return { voice: pick, matchedGender: true };

    // 4. No gender info anywhere - deterministically split whatever voices exist so
    //    male/female always get two DIFFERENT voice objects (different engine = audibly
    //    different) instead of both silently landing on the same one.
    const pool = au.length > 1 ? au : (en.length > 1 ? en : list);
    if (pool.length > 1) {
      pick = wantMale ? pool[0] : pool[pool.length - 1];
      return { voice: pick, matchedGender: false };
    }

    // 5. Genuinely only one voice exists on this whole device - nothing more we can do
    //    to differentiate; pitch/rate are a last-ditch attempt only in this rare case.
    pick = pool[0] || null;
    return { voice: pick, matchedGender: false };
  };

  // Aussie voice via the browser's own speech engine - free, unlimited, works in every browser.
  // Reads long stories in sentence groups so Chrome never cuts off mid-read.
  const speakBrowser = (fullText) => {
    try {
      window._ttsCancelled = false;
      window.speechSynthesis.cancel();
      const wantMale = selectedVoice === 'male';
      const { voice: pick, matchedGender } = pickAuVoice(wantMale);
      // If we couldn't confirm the picked voice is actually the right gender (e.g. only
      // one voice available on this browser), push pitch/rate further apart so male and
      // female are still audibly different instead of sounding identical.
      const pitchMale = matchedGender ? 0.9 : 0.6;
      const pitchFemale = matchedGender ? 1.03 : 1.5;
      const rateMale = matchedGender ? 0.94 : 0.86;
      const rateFemale = matchedGender ? 0.94 : 1.02;

      const sentences = String(fullText).split(/(?<=[.!?])\s+/);
      const queue = [];
      let buf = '';
      for (const s of sentences) {
        if ((buf + ' ' + s).length > 220) { if (buf.trim()) queue.push(buf.trim()); buf = s; }
        else { buf = buf ? buf + ' ' + s : s; }
      }
      if (buf.trim()) queue.push(buf.trim());
      if (!queue.length) queue.push(String(fullText));

      const totalLen = fullText.length || 1;
      let doneLen = 0;
      let idx = 0;
      const speakNext = () => {
        if (window._ttsCancelled || idx >= queue.length) { setSpeaking(false); return; }
        const part = queue[idx];
        const u = new SpeechSynthesisUtterance(part);
        if (pick) { u.voice = pick; u.lang = pick.lang || 'en-AU'; } else { u.lang = 'en-AU'; }
        u.rate = wantMale ? rateMale : rateFemale; u.pitch = wantMale ? pitchMale : pitchFemale; u.volume = 1.0;
        u.onstart = () => { setVoicePrep(false); setSpeaking(true); };
        u.onboundary = (ev) => {
          try {
            const sc = document.querySelector('.story-scroll');
            if (sc) {
              const p = Math.min(1, (doneLen + (ev.charIndex || 0)) / totalLen);
              const max = sc.scrollHeight - sc.clientHeight;
              if (max > 0) sc.scrollTop = Math.max(0, Math.min(max, p * sc.scrollHeight - sc.clientHeight / 2));
            }
          } catch (e) {}
        };
        u.onend = () => { doneLen += part.length + 1; idx++; speakNext(); };
        u.onerror = () => { doneLen += part.length + 1; idx++; speakNext(); };
        window._ttsUtter = u;
        window.speechSynthesis.speak(u);
      };
      setVoicePrep(false);
      setSpeaking(true);
      speakNext();
    } catch (e) { setSpeaking(false); setVoicePrep(false); }
  };

  // Listen button - reads the current story aloud in the chosen Aussie voice.
  // Real Australian voices (AWS Polly Russell/Olivia via Puter.js) - runs client-side so it
  // never hits the datacenter-IP block that killed the old server-side Edge TTS approach.
  // Falls back to the browser's built-in voices if Puter is unavailable for any reason.
  const speakPuter = async (fullText, wantMale) => {
    if (typeof puter === 'undefined' || !puter.ai || !puter.ai.txt2speech) {
      speakBrowser(fullText);
      return;
    }
    window._ttsCancelled = false;
    setVoicePrep(true);

    const sentences = String(fullText).split(/(?<=[.!?])\s+/);
    const queue = [];
    let buf = '';
    for (const s of sentences) {
      if ((buf + ' ' + s).length > 1200) { if (buf.trim()) queue.push(buf.trim()); buf = s; }
      else { buf = buf ? buf + ' ' + s : s; }
    }
    if (buf.trim()) queue.push(buf.trim());
    if (!queue.length) queue.push(String(fullText));

    const totalLen = fullText.length || 1;
    let doneLen = 0;
    let idx = 0;

    const playNext = async () => {
      if (window._ttsCancelled || idx >= queue.length) { setSpeaking(false); return; }
      const part = queue[idx];
      try {
        const audio = wantMale
          ? await puter.ai.txt2speech(part, { voice: 'Russell', engine: 'standard', language: 'en-AU' })
          : await puter.ai.txt2speech(part, { voice: 'Olivia', engine: 'neural', language: 'en-AU' });
        if (window._ttsCancelled) return;
        window._ttsAudio = audio;
        audio.onplay = () => { setVoicePrep(false); setSpeaking(true); };
        audio.ontimeupdate = () => {
          try {
            const sc = document.querySelector('.story-scroll');
            if (sc && audio.duration) {
              const partProgress = audio.currentTime / audio.duration;
              const p = Math.min(1, (doneLen + partProgress * part.length) / totalLen);
              const max = sc.scrollHeight - sc.clientHeight;
              if (max > 0) sc.scrollTop = Math.max(0, Math.min(max, p * sc.scrollHeight - sc.clientHeight / 2));
            }
          } catch (e) {}
        };
        audio.onended = () => {
          doneLen += part.length;
          idx += 1;
          playNext();
        };
        audio.onerror = () => { setVoicePrep(false); speakBrowser(fullText); };
        audio.play();
      } catch (e) {
        // Puter failed mid-story (rare) - fall back to browser voices for the rest.
        setVoicePrep(false);
        speakBrowser(fullText);
      }
    };
    playNext();
  };

  const speakStory = () => {
    if (!chunks.length) return;
    if (speaking || voicePrep) { stopVoice(); return; }
    stopVoice();
    const joined = chunks.map(c => c.text).join(' ');
    const text = joined.substring(0, 5000);
    const wantMale = selectedVoice === 'male';
    speakPuter(text, wantMale);
  };
  const saveStory = async () => {
    if (!chunks.length || !userId) return;
    const fullText = chunks.map(c => c.text).join("\n\n---\n\n");
    const preview = chunks[0].text.split("\n\n")[0].substring(0, 100);
    const title = chunks[0].text.split(" ").slice(0, 6).join(" ") + "...";
    const entry = { id: activeStory, title, preview, text: fullText, mode, savedAt: Date.now() };
    const newId = await upsertStory(userId, entry);
    if (!newId) { setSaveMsg("Could not save \u2014 please try again"); setTimeout(() => setSaveMsg(""), 2500); return; }
    setStories(await fetchStories(userId));
    setActiveStory(newId);
    setSaveMsg("Story saved ✦"); setTimeout(() => setSaveMsg(""), 2500);
  };

  const openStory = (s) => {
    stopVoice();
    scrollModeRef.current = 'top';
    setActiveStory(s.id); setMode(s.mode || "older");
    setChunks(s.text.split("\n\n---\n\n").map((t, i) => ({ id: i, text: t })));
    setStarted(true); setSaveMsg(""); setScreen("story");
  };

  const newStory = () => {
    stopVoice();
    const a = allowance();
    if (!a.ok) { setScreen("limit"); return; }
    scrollModeRef.current = 'top';
    setActiveStory(null); setChunks([]); setStarted(false); setSaveMsg(""); setScreen("story");
  };

  const callStory = async (isNew) => {
    stopVoice();
    const a = allowance();
    if (!a.ok) { setScreen("limit"); return; }
    setLoading(true);
    scrollModeRef.current = isNew ? 'top' : 'bottom';
    if (isNew) { setChunks([]); setStarted(false); setActiveStory(null); fadeOutMusic(); }
    const allText = chunks.map(c => c.text).join("\n\n");
    const prompt = isNew ? `Begin a new story. Speak as ${m.teller}.` : `Continue and deepen this story:\n\n${allText}`;
    try {
      const res = await fetch("/api/story", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "system", content: SYSTEMS[mode] }, { role: "user", content: prompt }] })
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "The voice fades into the mist... try once more.";
      setChunks(prev => isNew ? [{ id: Date.now(), text }] : [...prev, { id: Date.now(), text }]);
      setStarted(true);
      if (isNew) await incUsage();
    } catch { setChunks(prev => [...prev, { id: Date.now(), text: "The connection wavers... breathe and try again." }]); }
    setLoading(false);
  };

  const a = allowance();
  const pct = Math.min(100, ((a.max - a.rem) / a.max) * 100);

  const ModeSelector = () => (
    <div className="mode-sel">
      {Object.entries(MODES).map(([key, mv]) => (
        <button key={key} className={`mode-btn ${mode === key ? "active" : ""}`}
          onClick={() => setMode(key)}
          style={mode === key ? { "--mp": mv.primary, "--mg": mv.glow, "--ms": mv.subtle, "--mt": mv.text, "--border": mv.border } : {}}>
          {mv.badge}
        </button>
      ))}
    </div>
  );

  const Fireflies = ({ count = 12 }) => (
    <>
      {FIREFLIES.slice(0, count).map(f => (
        <div key={f.id} className="ff" style={{
          left: `${f.left}%`, top: `${f.top}%`, width: f.size, height: f.size,
          "--fd": `${f.dur}s`, "--fdl": `${f.delay}s`, "--ftw": `${f.dur * 0.7}s`,
          "--fy": `${f.drift}px`, "--fx": `${f.drift * 0.6}px`
        }} />
      ))}
    </>
  );

  const Orb = ({ size = 80 }) => (
    <div className="orb-wrap" style={{ width: size + 30, height: size + 30 }}>
      <div className="orb" style={{ width: size, height: size, background: `radial-gradient(circle at 38% 32%, ${m.orbA}, ${m.orbB} 55%, ${m.orbC})` }} />
      <div className="orb-ring" />
      <div className="orb-ring2" />
    </div>
  );

  if (screen === "splash") return (
    <div className="app" style={{ ...cssVars }}>
      <style>{css}</style>
      <Fireflies count={20} />
      <div className="screen splash">
        <Orb size={84} />
        <div className="glow-title">The Storyteller</div>
        <div className="glow-sub">✦ mystical tales for all ages ✦</div>
        <ModeSelector />
        <div className="splash-body">{m.landingText}</div>
        <div className="splash-actions">
          <button className="btn-glow" onClick={() => { setAuthTab("signup"); setScreen("auth"); }}>✦  Create Account</button>
          <button className="btn-outline-glow" onClick={() => { setAuthTab("login"); setScreen("auth"); }}>Login</button>
          <button className="btn-ghost" onClick={handleGuest}>Try free — no sign up needed</button>
        </div>
        <div className="splash-note">3 free stories · No card needed</div>
      </div>
    </div>
  );

  if (screen === "auth") return (
    <div className="app" style={{ ...cssVars }}>
      <style>{css}</style>
      <Fireflies count={10} />
      <div className="screen auth-wrap">
        <button className="btn-ghost" onClick={() => setScreen("splash")}>← back</button>
        <div style={{ textAlign: "center" }}><Orb size={56} /></div>
        <div className="glow-title" style={{ textAlign: "center", fontSize: 16 }}>✦ Join the Realm ✦</div>
        <div className="auth-tabs">
          <button className={`auth-tab ${authTab === "login" ? "active" : ""}`} onClick={() => { setAuthTab("login"); setAuthErr(""); setAuthOk(""); }}>Login</button>
          <button className={`auth-tab ${authTab === "signup" ? "active" : ""}`} onClick={() => { setAuthTab("signup"); setAuthErr(""); setAuthOk(""); }}>Sign Up</button>
        </div>
        {authTab === "signup" && (
          <div className="field"><label>Your Realm Name</label><input value={uname} onChange={e => setUname(e.target.value)} placeholder="e.g. shadowwalker" /></div>
        )}
        <div className="field"><label>Email</label><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        <div className="field"><label>Secret Word</label><input type="password" autoComplete={authTab === "signup" ? "new-password" : "current-password"} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="at least 6 characters" onKeyDown={e => e.key === "Enter" && !authBusy && handleAuth()} /></div>
        {authErr && <div className="msg-err">{authErr}</div>}
        {authOk  && <div className="msg-ok">{authOk}</div>}
        <button className="btn-glow" disabled={authBusy} onClick={handleAuth}>{authBusy ? "One moment..." : (authTab === "login" ? "Enter the Realm" : "Begin My Journey")}</button>
        <button className="btn-ghost" style={{ textAlign: "center" }} onClick={handleGuest}>Continue as guest (3 free stories)</button>
      </div>
    </div>
  );

  if (screen === "pricing") return (
    <div className="app" style={{ ...cssVars }}>
      <style>{css}</style>
      <Fireflies count={8} />
      <div className="screen">
        <div className="hdr">
          <div className="hdr-row"><button className="btn-ghost" onClick={() => setScreen(user ? "home" : "splash")}>← back</button></div>
          <div className="glow-title" style={{ fontSize: 16 }}>Choose Your Realm</div>
        </div>
        <div className="pricing-wrap">
          <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--mt)", opacity: 0.45, textAlign: "center", marginBottom: 18 }}>Unlimited tales await — pick what suits you</div>
          {Object.entries(TIERS).map(([key, t]) => {
            const isFeat = key === "full";
            return (
              <div key={key} className={`tier-card ${isFeat ? "featured" : ""}`}>
                {isFeat && <div className="tier-tag">Most Popular</div>}
                <div className="tier-header">
                  <div className="tier-name">{t.name}</div>
                  <div className="tier-price">{t.price}<span>{t.period}</span></div>
                </div>
                <ul className="tier-perks">{TIER_PERKS[key].map((p, i) => <li key={i}>{p}</li>)}</ul>
                {tier === key && user
                  ? <div style={{ textAlign: "center", fontSize: 12, color: m.primary, fontStyle: "italic" }}>✦ Your current plan</div>
                  : key === "free"
                    ? <button className="btn-outline-glow" onClick={() => setScreen(user ? "home" : "splash")}>Continue Free</button>
                    : <button className="btn-glow" onClick={() => {
                        const url = key === 'standard' ? 'https://buy.stripe.com/aFa3cv2EsbSyghS2j5abK00' : 'https://buy.stripe.com/14AaEX3Iw6ye8Pq9LxabK01';
                        window.open(url, '_blank');
                      }}>Subscribe — {t.price}{t.period}</button>
                }
              </div>
            );
          })}
          <div style={{ borderTop: `1px solid var(--border)`, paddingTop: 16, marginTop: 12 }}>
            <div className="section-lbl" style={{ marginBottom: 10 }}>Have a promo or beta code?</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="Enter code..." onKeyDown={e => e.key === "Enter" && handlePromo()}
                style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid var(--border)`, borderRadius: 8, padding: "10px 12px", color: "var(--mt)", fontFamily: "Georgia,serif", fontSize: 14, outline: "none", letterSpacing: 2 }} />
              <button className="btn-glow" style={{ width: "auto", padding: "10px 16px", fontSize: 12 }} onClick={handlePromo}>Apply</button>
            </div>
            {promoErr && <div className="msg-err" style={{ marginTop: 8 }}>{promoErr}</div>}
            {promoMsg && <div className="msg-ok" style={{ marginTop: 8 }}>{promoMsg}</div>}
          </div>
        </div>
      </div>
    </div>
  );

  if (screen === "limit") return (
    <div className="app" style={{ ...cssVars }}>
      <style>{css}</style>
      <Fireflies count={8} />
      <div className="screen">
        <div className="hdr"><div className="hdr-row"><button className="btn-ghost" onClick={() => setScreen(user ? "home" : "splash")}>← back</button></div></div>
        <div className="limit-screen">
          <Orb size={60} />
          <div className="limit-title">The Veil Closes</div>
          <div className="limit-body">
            {!user ? "You've used your 3 free stories. Create an account and subscribe to continue."
              : tier === "free" ? "You've reached your story limit. Upgrade to hear more tales."
              : `Your ${TIERS[tier].stories} adventures for today are complete ✦ Rest well — your next tales arrive tomorrow, and the realm will be waiting! 🌙`}
          </div>
          {!user && <button className="btn-glow" onClick={() => { setAuthTab("signup"); setScreen("auth"); }}>Create Free Account</button>}
          {(tier === "free" || !user) && <button className="btn-glow" onClick={() => setScreen("pricing")}>✦ {user ? "Upgrade My Realm" : "See All Plans"}</button>}
          <button className="btn-ghost" onClick={() => setScreen(user ? "home" : "splash")}>Maybe later</button>
        </div>
      </div>
    </div>
  );

  if (screen === "home") return (
    <div className="app" style={{ ...cssVars }}>
      <style>{css}</style>
      <Fireflies count={14} />
      <div className="screen">
        <div className="hdr">
          <div className="hdr-row">
            <div className="hdr-user">{user ? `✦ ${user}` : "✦ guest"}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="mute-btn" onClick={() => setMuted(mu => !mu)}>{muted ? "🔇" : "🎵"}</button>
              {user && <button className="btn-ghost" onClick={() => setScreen("pricing")} style={{ color: m.primary, opacity: 0.8, fontSize: 11 }}>{tier === "free" ? "Upgrade" : TIERS[tier].name}</button>}
              <button className="btn-ghost" onClick={user ? logout : () => setScreen("splash")}>{user ? "leave" : "home"}</button>
            </div>
          </div>
          <div className="glow-title" style={{ fontSize: 17 }}>{m.teller}</div>
          <div className="glow-sub">{m.sub}</div>
          <ModeSelector />
        </div>
        <div className="usage-wrap">
          <div className="usage-row">
            <span className="usage-lbl">{user ? (TIERS[tier].daily ? "Today" : "Stories") : "Free trial"}</span>
            <span className="usage-val">{a.label}</span>
          </div>
          <div className="usage-track"><div className="usage-fill" style={{ width: `${pct}%` }} /></div>
          {a.rem === 0 && <div className="upgrade-nudge" onClick={() => setScreen("pricing")}>Upgrade for more →</div>}
          {a.rem > 0 && tier !== "full" && user && <div className="upgrade-nudge" onClick={() => setScreen("pricing")}>Upgrade plan →</div>}
        </div>
        <div className="home-body">
          <button className="btn-glow" style={{ marginBottom: 16 }} onClick={newStory}>{m.btnLabel}</button>
          {user ? (
            <>
              <div className="section-lbl">Your saved tales ({stories.length})</div>
              {stories.length === 0 && <div className="empty">No tales saved yet...<br />Your first story awaits above.</div>}
              {stories.map(s => {
                const sm = MODES[s.mode] || MODES.older;
                return (
                  <div key={s.id} className="story-card" onClick={() => openStory(s)}>
                    <div className="badge" style={{ "--mp": sm.primary, "--ms": sm.subtle, "--border": sm.border }}>{sm.badge}</div>
                    <div className="card-title">{s.title}</div>
                    <div className="card-preview">{s.preview}...</div>
                    <div className="card-meta">{new Date(s.savedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="empty">
              Sign up free to save your stories<br />and continue tales anytime.<br /><br />
              <span style={{ cursor: "pointer", color: m.primary, textShadow: `0 0 8px ${m.glow}` }} onClick={() => setScreen("auth")}>Create account →</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (screen === "story") return (
    <div className="app app-story" style={{ ...cssVars }}>
      <style>{css}</style>
      <Fireflies count={10} />
      <div className="screen">
        <div className="hdr">
          <div className="hdr-row">
            <button className="btn-ghost" onClick={() => { setScreen(user ? "home" : "splash"); fadeInMusic(); }}>← {user ? "my tales" : "home"}</button>
            <div className="badge" style={{ "--mp": m.primary, "--ms": m.subtle, "--border": m.border }}>{m.badge}</div>
          </div>
          <div className="glow-title" style={{ fontSize: 16 }}>{m.teller}</div>
          <div className="glow-sub" style={{ fontSize: 11 }}>{m.sub}</div>
        </div>
        <div className="story-scroll">
          {chunks.length === 0 && !loading && (
            <div className="story-landing">
              <Orb size={68} />
              <div className="story-landing-text">{m.landingText}</div>
            </div>
          )}
          {chunks.length > 0 && (
            <div className="story-inner">
              {chunks.map((chunk, i) => (
                <div key={chunk.id}>
                  {i > 0 && <div className="crystal-div">✦  ✦  ✦</div>}
                  <div className="chunk">
                    {chunk.text.split(/\n\n+/).filter(Boolean).map((p, j) => <p key={j} className="para">{p}</p>)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {loading && <div className="loading-p">{m.loadingText}</div>}
          <div className="scroll-end" ref={endRef} />
        </div>
        <div className="controls">
          {started && chunks.length > 0 && (
            <div className="voice-bar">
              <button className={`voice-btn ${speaking ? "speaking" : ""}`} onClick={speakStory} disabled={voicePrep}>
                {voicePrep ? "✦ preparing voice..." : speaking ? "⏹ Stop" : "🔊 Listen"}
              </button>
              <select className="voice-select" value={selectedVoice} onChange={e => { stopVoice(); setSelectedVoice(e.target.value); }}>
                {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              {voicePrep && <div className="voice-note">First listen loads the voice once — after that it's instant.</div>}
            </div>
          )}
          {!started ? (
            <button className="btn-glow" onClick={() => callStory(true)} disabled={loading}>
              {loading ? "Weaving..." : m.btnLabel}
            </button>
          ) : (
            <>
              <button className="btn-glow" onClick={() => callStory(false)} disabled={loading}>
                {loading ? "Weaving..." : m.contLabel}
              </button>
              {saveMsg ? <div className="save-msg">{saveMsg}</div> : (
                <div className="btn-row">
                  {user && <button className="btn-sm" onClick={saveStory} disabled={loading}>Save</button>}
                  <button className="btn-sm" onClick={() => callStory(true)} disabled={loading}>New Story</button>
                  <button className="btn-sm" onClick={() => { setScreen(user ? "home" : "splash"); fadeInMusic(); }}>← Home</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return null;
}