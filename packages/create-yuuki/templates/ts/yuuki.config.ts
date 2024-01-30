import adapter from '@yuukijs/adapter-cloudflare-workers'
import type { YuukiConfig } from 'yuuki.js'

export default {
  token: process.env.BOT_TOKEN,
  devGuildId: process.env.DEV_GUILD_ID,
  adapter: adapter(),
} satisfies YuukiConfig
