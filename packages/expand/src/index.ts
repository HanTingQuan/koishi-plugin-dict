import type { Context } from 'koishi'
import { Schema } from 'koishi'
import { DictSource } from 'koishi-plugin-dict'

class ExpandDictSource extends DictSource {
  static name = 'dict-expand'

  constructor(ctx: Context, public config: ExpandDictSource.Config) {
    super(ctx)
  }

  async lookupRecursive(parent: string): Promise<string[]> {
    const children = await this.ctx.dict.lookup(parent)
    if (!children.length)
      return [this.ctx.dict.split(parent).pop()!]
    const results = await Promise.all(children.map(child =>
      this.lookupRecursive(this.ctx.dict.join(parent, child))))
    return results.flat()
  }

  override async lookup(key: string) {
    if (key.startsWith('...'))
      return this.lookupRecursive(key.slice(3))
    return Promise.resolve([])
  }
}

namespace ExpandDictSource {
  export interface Config {}
  export const Config: Schema<Config> = Schema.object({})
}

export default ExpandDictSource
