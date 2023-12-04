# @yuukijs/adapter-cloudflare-workers

Adapter for deploying serverless bots to Cloudflare Workers

## Setting Up

Install the required dev dependencies:

```sh
npm i -D @yuukijs/adapter-cloudflare-workers
npm i -D wrangler
```

Install the adapter into your config:

```diff
+ import adapter from '@yuukijs/adapter-cloudflare-workers'

  export default {
+   adapter: adapter(),
  }
```

Then, using Cloudflare's [Wrangler CLI](https://npm.im/wrangler), set your
bot's **token** and **public key**.

```sh
wrangler secret put YUUKI_BOT_TOKEN
wrangler secret put YUUKI_PUBLIC_KEY
```
