import type { DictSource } from './source'
import { Context, remove, Schema, Service } from 'koishi'
import * as Command from './command'

export * from './source'

declare module 'koishi' {
  interface Context {
    dict: DictService
  }
}

class DictService extends Service {
  private sources: DictSource[] = []

  constructor(ctx: Context, config: Config) {
    super(ctx, 'dict', true)
    this.config = config
  }

  register(source: DictSource) {
    return this[Context.origin].effect(() => {
      this.sources.push(source)
      return () => remove(this.sources, source)
    })
  }

  async lookup(key: string) {
    for (const source of this.sources) {
      const result = await source.lookup(key)
      if (result?.length)
        return result
    }
  }

  async find(...values: string[]) {
    const founds = Object.fromEntries(values.map(value => [value, []]))
    for (const source of this.sources) {
      await source.find(values, founds)
    }
    return founds
  }
}

export interface Config {
  delimiter: string
}

export const Config = Schema.object({
  delimiter: Schema.string().default(' ').description('默认字段分隔符。'),
})

export function apply(ctx: Context, config: Config) {
  ctx.plugin(DictService, config)
  ctx.plugin(Command, config)
}
