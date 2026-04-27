import type { Context } from 'koishi'

export abstract class DictSource {
  static inject = ['dict']

  constructor(public ctx: Context) {
    this.ctx.dict.register(this)
  }

  async availables(): Promise<string[]> { return [] }

  // eslint-disable-next-line unused-imports/no-unused-vars
  async lookup(key: string): Promise<string[]> { return [] }

  async find(values: string[], founds: Record<string, string[]>) {
    for (const key of await this.availables()) {
      const result = await this.lookup(key) || []
      for (const value of values) {
        if (result.includes(value))
          founds[key].push(value)
      }
    }
  }
}
