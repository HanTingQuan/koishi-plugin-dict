import type { Context } from 'koishi'
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
            this.tryLoadDict(entry.name.replace(/\.json$/, ''), JSON.parse(content))
          }
          else if (entry.name.endsWith('.csv')) {
            const content = await readFile(resolve(entry.parentPath, entry.name), 'utf-8')
            const name = entry.name.replace(/\.csv$/, '')
            const typeToNames: Record<string, string[]> = {}
            const parser = parse(content, { columns: true })
            parser.on('data', ({ name, type }) => {
              if (type)
                (typeToNames[type] ||= []).push(name)
            })

            parser.on('end', () => {
              for (const type in typeToNames)
                this.loadDict(`${name}/${type}`, typeToNames[type])
            })
          }
        }
      })
      .then(() => logger.info(`loaded ${this.dicts.size} dicts.`))
  }

  dicts: Map<string, { source: string, entries: string[] }> = new Map()

  override availablesSync(): string[] {
    return Array.from(this.dicts.keys())
  }

  tryLoadDict(name: string, data: any, depth = 0) {
    if (typeof data === 'string') {
      const lines = data.split('\n').filter(line => line.trim() !== '')
      if (lines.length > 1)
        this.loadDict(name, lines, depth)
      else
        this.loadDict(name, Array.from(data), depth)
    }
    else if (Array.isArray(data) && data.every(item => typeof item === 'string')) {
      this.loadDict(name, data, depth)
    }
    else if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        this.tryLoadDict(`${name}/${key}`, data[key], depth + 1)
      }
    }
    else {
      logger.warn(`unknown dict format: ${name}`)
    }
  }

  loadDict(name: string, values: string[], depth = 0) {
    this.dicts.set(name, { source: name, entries: values })
    if (depth < this.config.logDepth)
      logger.info(`loaded dict ${name} with ${values.length} values.`)
  }

  override lookupSync(name: string): string[] {
    if (this.dicts.has(name))
      return this.dicts.get(name)!.entries
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
