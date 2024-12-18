const { createServer } = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");
const { RealtimeService, RealtimeTranscriber } = require("assemblyai");

const app = express();
const server = createServer(app);
// the WebSocket server for the Twilio media stream to connect to.
const wss = new WebSocketServer({ server });

app.get("/", (_, res) =>
  res.type("text").send("Twilio media stream transcriber")
);

// Tell Twilio to say something and then establish a media stream with the WebSocket server
app.post("/", async (req, res) => {
  res.type("xml").send(
    `<Response>
        <Say>
          Speak to see your audio transcribed in the console.
        </Say>
        <Connect>
          <Stream url='wss://${req.headers.host}' />
        </Connect>
      </Response>`
  );
});

wss.on("connection", async (ws) => {
  console.log("Twilio media stream WebSocket connected");
  const transcriber = new RealtimeTranscriber({
    apiKey: "1f8549c0bd2946f4b60e5f6a36c2ee33",
    // Twilio media stream sends audio in mulaw format
    encoding: "pcm_mulaw",
    // Twilio media stream sends audio at 8000 sample rate
    sampleRate: 8000,
  });
  const transcriberConnectionPromise = transcriber.connect();

  transcriber.on("transcript.partial", (partialTranscript) => {
    // Don't print anything when there's silence
    if (!partialTranscript.text) return;
    console.clear();
    console.log(partialTranscript.text);
  });

  transcriber.on("transcript.final", (finalTranscript) => {
    console.clear();
    console.log(finalTranscript.text);
  });

  transcriber.on("open", () => console.log("Connected to real-time service"));
  transcriber.on("error", console.error);
  transcriber.on("close", () =>
    console.log("Disconnected from real-time service")
  );

  // Message from Twilio media stream
  ws.on("message", async (message) => {
    const msg = JSON.parse(message);
    switch (msg.event) {
      case "connected":
        console.info("Twilio media stream connected");
        break;

      case "start":
        console.info("Twilio media stream started");
        break;

      case "media":
        // Make sure the transcriber is connected before sending audio
        await transcriberConnectionPromise;
        transcriber.sendAudio(Buffer.from(msg.media.payload, "base64"));
        break;

      case "stop":
        console.info("Twilio media stream stopped");
        break;
    }
  });

  ws.on("close", async () => {
    console.log("Twilio media stream WebSocket disconnected");
    await transcriber.close();
  });

  await transcriberConnectionPromise;
});

console.log("Listening on port 8080");
server.listen(8080);
