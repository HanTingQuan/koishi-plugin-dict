import type { Context } from 'koishi'

export interface Found {
  key: string
  weak: boolean
}

export abstract class DictSource {
  static inject = ['dict']

  constructor(public ctx: Context) {
    this.ctx.dict.register(this)
  }

  async availables(): Promise<string[]> { return [] }

  // eslint-disable-next-line unused-imports/no-unused-vars
  lookupSync(key: string): string[] { return [] }

  async lookup(key: string): Promise<string[]> { return this.lookupSync(key) }

  async find(values: string[], founds: Record<string, Found[]>) {
    for (const key of await this.availables()) {
      const result = await this.lookup(key) || []
      const collected = result.join(' ')
      for (const value of values) {
        if (result.includes(value))
          (founds[value] ||= []).push({ key, weak: false })
        else if (collected.includes(value))
          (founds[value] ||= []).push({ key, weak: true })
      }
    }
  }
}
