import type { Context, Dict } from 'koishi'
import { opendir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parse } from 'csv-parse'
import { Logger, Schema } from 'koishi'
import { DictSource } from 'koishi-plugin-dict'

const logger = new Logger('dict-local')

class LocalDictSource extends DictSource {
  constructor(ctx: Context, public config: LocalDictSource.Config) {
    super(ctx)
    opendir(resolve(ctx.baseDir, 'data', 'dicts'))
      .then(async (entries) => {
        for await (const entry of entries) {
          if (!entry.isFile() || entry.name.startsWith('~'))
            continue

          if (entry.name.endsWith('.txt')) {
            const content = await readFile(resolve(entry.parentPath, entry.name), 'utf-8')
            this.tryLoadDict(entry.name.replace(/\.txt$/, ''), content.replaceAll('\r\n', '\n').trim())
          }
          else if (entry.name.endsWith('.json')) {
            const content = await readFile(resolve(entry.parentPath, entry.name), 'utf-8')
            const key = entry.name.replace(/\.json$/, '')
            const data = JSON.parse(content)
            this.tryLoadDict(key, data)
          }
          else if (entry.name.endsWith('.csv')) {
            const content = await readFile(resolve(entry.parentPath, entry.name), 'utf-8')
            const typeToNames: Record<string, string[]> = {}
            const parser = parse(content, { columns: true })
            parser.on('data', ({ name, type }) => {
              if (type)
                (typeToNames[type] ||= []).push(name)
            })

            parser.on('end', () => {
              for (const type in typeToNames)
                this.loadDict(type, typeToNames[type])
            })
          }
        }
      })
      .then(() => logger.info(`loaded ${this.dicts.size} dicts.`))
  }

  dicts: Map<string, string[]> = new Map()
  aliases: Map<string, string[]> = new Map()

  availables(): Promise<string[]> {
    return Promise.resolve(Array.from(this.dicts.keys()))
  }

  tryLoadDict(key: string, data: any, depth = 0) {
    if (typeof data === 'string') {
      const lines = data.split('\n').filter(line => line.trim() !== '')
      if (lines.length > 1)
        this.loadDict(key, lines, depth)
      else
        this.loadDict(key, Array.from(data), depth)
    }
    else if (Array.isArray(data) && data.every(item => typeof item === 'string')) {
      this.loadDict(key, data, depth)
    }
    else if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        this.tryLoadDict(key, data[key], depth + 1)
      }
      if (depth === 0) {
        const flatKeys: (data: Dict) => string[]
          = data => Object.entries(data).flatMap(([key, value]) =>
            typeof value === 'object' ? flatKeys(value) : [key])
        this.loadDict(key, flatKeys(data), depth)
        return
      }
      this.aliases.set(key, Object.keys(data))
      if (depth < this.config.logDepth)
        logger.info(`set alias ${key} -> ${Object.keys(data).join(', ')}.`)
    }
    else {
      logger.warn(`unknown dict format: ${key}`)
    }
  }

  loadDict(key: string, values: string[], depth = 0) {
    this.dicts.set(key, values)
    if (depth < this.config.logDepth)
      logger.info(`loaded dict ${key} with ${values.length} values.`)
  }

  lookupSync(key: string): string[] {
    if (this.dicts.has(key))
      return this.dicts.get(key)!

    if (this.aliases.has(key)) {
      return this.aliases.get(key)!.flatMap(key => this.lookupSync(key))
    }

    return []
  }
}

namespace LocalDictSource {
  export interface Config {
    logDepth: number
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      logDepth: Schema.number().step(1).default(1).description('日志深度。'),
    }),
  ])
}

export default LocalDictSource
