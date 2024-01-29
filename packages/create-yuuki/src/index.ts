#! /usr/bin/env node
import { confirm, intro, log, outro, select, spinner, text } from '@clack/prompts'
import { cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import get_pm from 'which-pm-runs'
import { version as yuukijs } from '../../yuuki.js/package.json'
import { $, prompt, read_json, write_json } from './utils'

// @todo: non-interactive mode
// @todo: readme

// @todo: colorize
intro('create-yuuki')

const yuukijs_version = `^${yuukijs}` as const
const pm_info = get_pm()
const pm = pm_info?.name ?? 'npm'

if (!pm_info) {
  log.step('Using npm')
} else {
  log.step(`Using ${pm_info.name}@${pm_info.version}`)
}

const cwd = await prompt(text({
  message: 'cwd',
  placeholder: './',
  defaultValue: './',
}))

const target_dir = resolve(cwd)
const did_change_dir = process.cwd() !== target_dir
await mkdir(target_dir, { recursive: true })
process.chdir(target_dir)

let template = await prompt(select({
  message: 'Language',
  options: [
    { label: 'Typescript', value: 'ts', hint: 'Recommended' },
    { label: 'Javascript', value: 'js' },
  ],
})) as string

template = resolve(fileURLToPath(import.meta.url), '../../templates', template)

await cp(template, target_dir, {
  recursive: true,
  force: true,
  filter: s => !s.includes('node_modules'),
})

// @todo: add default adapter
// @todo: "fix" non-functioning jsdoc @satisfies export default
const pkg_json = await read_json('package.json')
const dev_deps = pkg_json.devDependencies as Record<string, string>
dev_deps['yuuki.js'] = yuukijs_version

await write_json('package.json', pkg_json)

const should_install_deps = await prompt(confirm({
  message: 'Install dependencies?',
  initialValue: true,
}))

let did_install_deps = false
if (should_install_deps) {
  const s = spinner()
  s.start(`Installing packages using ${pm}`)

  const err = await $`${pm} install`

  if (err) {
    s.stop('Failed to install dependecies!', err.code)
    log.error(err.message.trimEnd())
    log.error(`Please run \`${pm} install\` manually.`)
  } else {
    s.stop(`Installed dependencies using ${pm}.`)
    did_install_deps = true
  }
}

const should_init_git = await prompt(confirm({
  message: 'Initialize a git repo?',
  initialValue: true,
}))

if (should_init_git) {
  const s = spinner()
  s.start('Creating git repo')

  const err = await $`git init`

  if (err) {
    s.stop('Could not initialize git repo!', err.code)
    log.error(err.message.trimEnd())
    log.error('Please run `git init` manually.')
  } else {
    s.stop('Git repo created.')
  }
}

log.success('Success!')

outro('Your new bot is now ready!')

console.log('To get started, run the following commands:')
console.log()

const commands = []

if (did_change_dir) {
  commands.push(`  $ cd ${cwd}`)
}

if (!did_install_deps) {
  commands.push(`  $ ${pm} install`)
}

commands.push(`  $ ${pm} run dev`)

console.log(commands.join('\n'))
console.log()
