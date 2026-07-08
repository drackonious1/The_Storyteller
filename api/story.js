import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

// Give the serverless function more time to reach Edge TTS over WebSocket.
export const config = { maxDuration: 30 };

// ---- Edge TTS (Microsoft online neural voices) ----
// FREE. No API key. No character limit. No monthly wall.
// Aussie voices built in: en-AU-NatashaNeural (female), en-AU-WilliamNeural (male).
const EDGE_TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=' + EDGE_TRUSTED_TOKEN;

function edgeDateString() {
  return new Date().toString().replace(/GMT.*$/, 'GMT+0000 (Coordinated Universal Time)');
}

function buildSSML(text, voice, rate, pitch) {
  const safe = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-AU'>` +
    `<voice name='${voice}'>` +
    `<prosody rate='${rate}' pitch='${pitch}'>${safe}</prosody>` +
    `</voice></speak>`;
}

async function edgeSpeak(text, voice) {
  // Load ws OUTSIDE the promise so a missing module surfaces as a normal throw.
  let WebSocketMod;
  try {
    WebSocketMod = await import('ws');
  } catch (e) {
    throw new Error('ws-import-failed: ' + (e && e.message ? e.message : String(e)));
  }
  const WebSocket = WebSocketMod.default || WebSocketMod.WebSocket || WebSocketMod;
  if (typeof WebSocket !== 'function') {
    throw new Error('ws-not-a-constructor: typeof=' + typeof WebSocket);
  }

  return await new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(EDGE_WSS, {
        headers: {
          'Origin': 'chrome-extension://jdiccldimpsteenheleh',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        }
      });
    } catch (e) {
      return reject(new Error('ws-construct-failed: ' + (e && e.message ? e.message : String(e))));
    }

    const connectId = crypto.randomUUID().replace(/-/g, '');
    const chunks = [];
    let settled = false;
    const done = (err, buf) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch (e) {}
      err ? reject(err) : resolve(buf);
    };
    const timeout = setTimeout(() => done(new Error('edge-tts-timeout-25s')), 25000);

    ws.on('open', () => {
      try {
        const cfg = `X-Timestamp:${edgeDateString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
        ws.send(cfg);
        const ssml = buildSSML(text, voice, '-4%', '+0Hz');
        const msg = `X-RequestId:${connectId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${edgeDateString()}Z\r\nPath:ssml\r\n\r\n${ssml}`;
        ws.send(msg);
      } catch (e) {
        clearTimeout(timeout);
        done(new Error('ws-send-failed: ' + (e && e.message ? e.message : String(e))));
      }
    });

    ws.on('message', (data, isBinary) => {
      try {
        if (isBinary) {
          const buf = Buffer.from(data);
          const marker = Buffer.from('Path:audio\r\n');
          const headerEnd = buf.indexOf(marker);
          if (headerEnd !== -1) {
            chunks.push(buf.slice(headerEnd + marker.length));
          }
        } else {
          const s = data.toString();
          if (s.includes('Path:turn.end')) {
            clearTimeout(timeout);
            done(null, Buffer.concat(chunks));
          }
        }
      } catch (e) {
        clearTimeout(timeout);
        done(new Error('ws-message-failed: ' + (e && e.message ? e.message : String(e))));
      }
    });

    ws.on('error', (e) => {
      clearTimeout(timeout);
      done(new Error('ws-error: ' + (e && e.message ? e.message : String(e))));
    });
    ws.on('close', (code) => {
      clearTimeout(timeout);
      if (!settled) {
        if (chunks.length) done(null, Buffer.concat(chunks));
        else done(new Error('ws-closed-no-audio: code=' + code));
      }
    });
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};
    const { messages, action, text, voiceId } = body;

    // ---- Voice synthesis via Edge TTS (free, no key, no limit) ----
    if (action === 'speak') {
      const VOICE_MAP = {
        'natasha':  'en-AU-NatashaNeural',   // Aussie female
        'william':  'en-AU-WilliamNeural',   // Aussie male
        'freya':    'en-AU-FreyaNeural',      // Aussie female (younger)
        'annette':  'en-AU-AnnetteNeural',    // Aussie female
        'darren':   'en-AU-DarrenNeural',     // Aussie male
        'ken':      'en-AU-KenNeural',        // Aussie male
      };
      const voice = VOICE_MAP[voiceId] || 'en-AU-NatashaNeural';
      const audioBuffer = await edgeSpeak(String(text || '').slice(0, 5000), voice);
      if (!audioBuffer || audioBuffer.length === 0) {
        return res.status(502).json({ error: 'empty-audio-from-edge' });
      }
      return res.status(200).json({ audio: audioBuffer.toString('base64') });
    }

    // ---- Groq story generation (unchanged) ----
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages
      })
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    // Surface the REAL reason so we can see it in the response body.
    return res.status(500).json({
      error: 'server-error',
      detail: String(error && error.message ? error.message : error),
      stack: String(error && error.stack ? error.stack : '').slice(0, 600)
    });
  }
}
