import type { DictSource, Found } from './source'
import { Context, remove, Service } from 'koishi'
import * as Command from './command'

export * from './source'

declare module 'koishi' {
  interface Context {
    dict: DictService
  }
}

class DictService extends Service {
  private sources: DictSource[] = []

  constructor(ctx: Context, config: Command.Config) {
    super(ctx, 'dict', true)
    this.config = config
  }

  register(source: DictSource) {
    return this[Context.origin].effect(() => {
      this.sources.push(source)
      return () => remove(this.sources, source)
    })
  }

  availables() {
    return Promise.all(this.sources.map(source => source.availables()))
      .then(results => results.flat())
  }

  async lookup(key: string) {
    for (const source of this.sources) {
      const result = await source.lookup(key)
      if (result?.length)
        return result
    }
  }

  lookupSync(key: string) {
    for (const source of this.sources) {
      const result = source.lookupSync(key)
      if (result?.length)
        return result
    }
  }

  async find(...values: string[]): Promise<Record<string, Found[]>> {
    const founds = Object.fromEntries(values.map(value => [value, []]))
    for (const source of this.sources) {
      await source.find(values, founds)
    }
    return founds
  }
}

export function apply(ctx: Context, config: Command.Config) {
  ctx.plugin(DictService, config)
  ctx.plugin(Command, config)
}
