/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { isCancel } from '@clack/prompts'
import { exec, type ExecException } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'

export async function read_json<T = Record<string, unknown>>(file: string) {
  const contents = await readFile(file, 'utf-8')
  return JSON.parse(contents) as T
}

export function write_json(file: string, value: unknown) {
  return writeFile(file, JSON.stringify(value, null, 2))
}

export async function prompt<T extends Promise<unknown>>(task: T) {
  const res = await task
  if (isCancel(res)) {
    process.exit(1)
  }
  return res as Exclude<Awaited<T>, symbol>
}

export function $(cmd: readonly string[], ...args: unknown[]) {
  return new Promise<ExecException | null>(res => {
    exec(String.raw({ raw: cmd }, ...args), res)
  })
}
