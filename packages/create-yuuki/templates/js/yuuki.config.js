import adapter from '@yuukijs/adapter-cloudflare-workers'

/** @satisfies {import('yuuki.js').YuukiConfig} */
const config = {
  token: process.env.BOT_TOKEN,
  devGuildId: process.env.DEV_GUILD_ID,
  adapter: adapter(),
}

export default config
