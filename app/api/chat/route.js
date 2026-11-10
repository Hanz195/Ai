// Versi Gemini (jatah gratis Google). Tidak perlu install paket tambahan.
// Kunci dibuat di https://aistudio.google.com lalu disimpan di .env.local:
//   GEMINI_API_KEY=kunci-kamu

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Cek daftar model gratis yang tersedia di Google AI Studio; ganti bila perlu.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_HISTORY = 20;
const MAX_CHARS = 4000;

const SYSTEM_PROMPT = `Kamu adalah asisten AI yang ramah dan membantu.
Jawab dalam bahasa yang dipakai pengguna (default: Bahasa Indonesia).
Jawab ringkas dan jelas; beri langkah-langkah bila diminta.
Jika tidak yakin, katakan terus terang.`;

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return [];
  const msgs = raw
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== ""
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_HISTORY);

  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

export async function POST(req) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "GEMINI_API_KEY belum diatur di .env.local." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const messages = cleanMessages(body?.messages);
  if (messages.length === 0) {
    return Response.json({ error: "Pesan kosong." }, { status: 400 });
  }

  const upstream = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
    signal: req.signal,
  });

  if (!upstream.ok || !upstream.body) {
       const errText = await upstream.text();
   console.error("Gemini error:", upstream.status, errText.replace(/\s+/g, " ").slice(0, 400));
    return Response.json(
      { error: "Layanan AI sedang bermasalah atau jatah gratis habis." },
      { status: 502 }
    );
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const data = t.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const text = JSON.parse(data).choices?.[0]?.delta?.content;
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // abaikan potongan yang bukan JSON utuh
            }
          }
        }
        controller.close();
      } catch (err) {
        console.error("Stream error:", err);
        controller.error(err);
      }
    },
    cancel() {
      upstream.body.cancel();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}