const { AssemblyAI } = require('assemblyai');
require('dotenv').config();

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

async function run() {
    try {
        const transcript = await client.transcripts.transcribe({
            audio: 'https://assembly.ai/sports_coaching.mp3'
        });
        console.log("Words keys:", Object.keys(transcript.words[0] || {}));
        console.log("Utterances:", transcript.utterances ? transcript.utterances.length : 'none');
        console.log("Full text length:", transcript.text ? transcript.text.length : 0);
    } catch (err) {
        console.error("Test Error:", err);
    }
}
run();
