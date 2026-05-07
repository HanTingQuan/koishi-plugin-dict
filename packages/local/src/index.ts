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
          if (entry.name.endsWith('.json')) {
            const name = entry.name.slice(0, -5)
            const content = await readFile(fullPath, this.config.encoding)
            this.tryLoadDict(name, JSON.parse(content))
          }
          else if (entry.name.endsWith('.csv')) {
            const name = entry.name.slice(0, -4)
            const content = await readFile(fullPath, this.config.encoding)
            const parser = parse(content, { columns: true })
            const typeToNames: Record<string, string[]> = {}
            const tree: { level: number, children?: any[] } = { level: 0 }
            const stack = [tree]
            parser.on('data', (data: {
              type?: string
              name?: string
              level?: string
            }) => {
              if (data.type && data.name)
                (typeToNames[data.type] ||= []).push(data.name)
              if (data.level) {
                let last = stack[stack.length - 1]
                const current = Object.assign(data, { level: Number(data.level) })
                if (current.level > last.level) {
                  (last.children ||= []).push(current)
                }
                else if (current.level === last.level) {
                  stack.pop()
                  last = stack[stack.length - 1]
                  last.children!.push(current)
                }
                else {
                  while (last.level >= current.level) {
                    stack.pop()
                    last = stack[stack.length - 1]
                  }
                  last.children!.push(current)
                }
                stack.push(current)
              }
            })
            const loadDict = this.loadDict.bind(this)
            function loadNode(name: string, node: typeof tree) {
              if (node.children) {
                loadDict(name, node.children.map(child => child.name).filter(Boolean))
                for (const child of node.children)
                  child.name && loadNode(`${name}/${child.name}`, child)
              }
            }
            parser.on('end', () => {
              for (const type in typeToNames)
                this.loadDict(`${name}/${type}`, typeToNames[type])
              loadNode(name, tree)
            })
          }
        }
      })
      .then(() => {
        logger.info(`loaded ${this.dicts.size} dicts.`)
        ctx.emit('dict/register', Array.from(this.dicts.keys()))
      })
  }

  dicts: Map<string, string[]> = new Map()

  tryLoadDict(name: string, data: any) {
    if (typeof data === 'string') {
      const lines = data.split('\n').filter(line => line.trim() !== '')
      const values = lines.length > 1 ? lines : Array.from(data)
      this.loadDict(name, values)
    }
    else if (Array.isArray(data) && data.every(item => typeof item === 'string')) {
      this.loadDict(name, data)
    }
    else if (typeof data === 'object' && data !== null) {
      for (const key in data)
        this.tryLoadDict(`${name}/${key}`, data[key])
    }
    else {
      logger.warn(`unknown dict format: ${name}`)
    }
  }

  loadDict(name: string, values: string[]) {
    this.dicts.set(name, values)
    logger.debug(`loaded dict ${name} with ${values.length} values.`)
  }

  override lookupSync(name: string): string[] {
    return this.dicts.get(name) || []
  }
}

namespace LocalDictSource {
  export interface Config {
    encoding: 'ascii' | 'utf8' | 'utf16le'
  }

  export const Config: Schema<Config> = Schema.object({
    encoding: Schema.union([
      Schema.const('ascii').description('ASCII'),
      Schema.const('utf8').description('UTF-8'),
      Schema.const('utf16le').description('UTF-16LE'),
    ]).default('utf8').description('文本文件编码。'),
  })
}

export default LocalDictSource
