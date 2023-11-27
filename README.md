# Yuuki.JS

> Next Generation Discord Bot Framework

- Serverless Ready
- Hot Code Reload
- Automatic Command Syncing
- ESM Compatible

Yuuki.JS is a new type of JS Discord bot framework with the same level of
features and tooling present in most modern frontend frameworks

By embracing Discord's **REST API** as the default instead of their **Gateway
API**, we can take advantage of any type of deployment:

- **Serverless**: For bots with simple functions. Effortlessly scale from free
to handling thousands of interactions
- **Self-Hosted**: The "vanilla" experience. Setup your bot in any way you like
- **Hybrid**: Take advantage of both worlds. Manage your bot's Gateway client
while having the flexibility of deploying to serverless

## Getting Started

To get started developing your own bot, you first need to get your **[bot's
token](https://discord.com/developers/applications)** and your test server's
**[guild id](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-)**.

```sh
npm create yuuki@latest my-bot
cd my-bot
npm run dev
```
