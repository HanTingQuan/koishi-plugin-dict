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
          const fullPath = resolve(entry.parentPath, entry.name)

          if (entry.name.endsWith('.txt')) {
            const name = entry.name.replace(/\.txt$/, '')
            const content = await readFile(fullPath, 'utf-8')
            this.loadDict(name, content
              .replaceAll('\r\n', '\n')
              .split('\n')
              .map(line => line.trim())
              .filter(Boolean))
          }
          else if (entry.name.endsWith('.json')) {
            const name = entry.name.replace(/\.json$/, '')
            const content = await readFile(fullPath, 'utf-8')
            this.tryLoadDict(name, JSON.parse(content))
          }
          else if (entry.name.endsWith('.csv')) {
            const name = entry.name.replace(/\.csv$/, '')
            const content = await readFile(fullPath, 'utf-8')
            const parser = parse(content, { columns: true })
            const typeToNames: Record<string, string[]> = {}
            parser.on('data', ({ name, type }) => {
              if (type && name)
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
      const values = lines.length > 1 ? lines : Array.from(data)
      this.loadDict(name, values, depth)
    }
    else if (Array.isArray(data) && data.every(item => typeof item === 'string')) {
      this.loadDict(name, data, depth)
    }
    else if (typeof data === 'object' && data !== null) {
      for (const key in data)
        this.tryLoadDict(`${name}/${key}`, data[key], depth + 1)
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
