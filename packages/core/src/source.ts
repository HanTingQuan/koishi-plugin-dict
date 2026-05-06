import type { Context } from 'koishi'

export interface Found {
  name: string
  weak: boolean
}

export abstract class DictSource<Config extends DictSource.Config = DictSource.Config> {
  static inject = ['dict']

  constructor(public ctx: Context, public config: Config) {
    this.ctx.dict.register(this)
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  lookupSync(name: string): string[] { return [] }
  async lookup(name: string): Promise<string[]> {
    return this.lookupSync(name)
  }

  async find(values: string[], founds: Record<string, Found[]>) {
    for (const name of this.ctx.dict.availables) {
      const result = await this.lookup(name) || []
      const collected = result.join(' ')
      for (const value of values) {
        if (result.includes(value))
          (founds[value] ||= []).push({ name, weak: false })
        else if (collected.includes(value))
          (founds[value] ||= []).push({ name, weak: true })
      }
    }
  }
}

export namespace DictSource {
  export interface Config {}
}
