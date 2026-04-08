# PodChat

[🇨🇳 中文说明](./README_zh.md)

## 🎙️ Project Description

PodChat is a Next.js-based interactive podcast application. It can process podcast audio into transcripts, summaries, speaker identities, and knowledge references, and it can also turn podcast speakers into AI characters you can talk to and hear.

The core experience of this project is that users do not just "listen to podcasts." After processing is complete, they can directly chat with the speakers from the show and even have multi-speaker group conversations.

## ✨ Highlights

- 👥 Multi-speaker group chat: users can talk with multiple podcast speakers at the same time, instead of only chatting with a single AI assistant
- 🔊 Direct speaker voice cloning: each AI speaker's voice is cloned directly from the corresponding podcast speaker for a more immersive experience
- 🎭 Preserved persona and tone: different speakers keep their own roles, tone, and contextual information
- 📝 Automatic structured podcast content: supports transcripts, chapters, summaries, and knowledge references
- 🌍 Bilingual reading experience: can be combined with transcript translation for a listen-and-read flow
- ⚙️ Flexible configuration: connect ElevenLabs, Firecrawl, and OpenAI-compatible model services in the built-in settings page

## 🚀 Local Setup

```bash
git clone https://github.com/fatC210/PodChat
cd PodChat
bun install
bun run build
bun run start
```

After the app starts, open `/settings` and configure the required services.

Common configurations include:

- ElevenLabs: for transcription, speaker voice cloning, and voice interaction
- OpenAI-compatible LLM APIs: for summaries and chat
- Firecrawl: for supplemental web-based knowledge references
