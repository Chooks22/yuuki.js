#! /usr/bin/env -S node --experimental-vm-modules
import { program } from 'commander'
import { config } from 'dotenv'
import { description, name, version } from '../package.json'

function not_implemented() {
  throw new Error('not implemented')
}

program.name(name)
  .description(description)
  .version(version, '-v, --version')

program.command('dev')
  .description('start a dev server')
  .action(() => {
    void import('./dev.js').then(mod => mod.default())
  })

program.command('build')
  .description('generate a production-ready build [TODO]')
  .action(() => {
    void import('./build.js').then(mod => mod.default())
  })

program.command('register')
  .description('register your commands to Discord globally [TODO]')
  .action(not_implemented)

if (process.argv.length > 2) {
  config({ path: '.env.local' })
  config()
  program.parse()
} else {
  program.help()
}
