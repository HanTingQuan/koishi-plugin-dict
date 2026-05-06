import type { Context } from 'koishi'
import { Logger, Schema } from 'koishi'
import { DictSource } from 'koishi-plugin-dict'

const logger = new Logger('dict-alias')

class AliasDictSource extends DictSource {
  constructor(ctx: Context, public config: AliasDictSource.Config) {
    super(ctx)
    ctx.on('dict/register', (names) => {
      for (const name of names) {
        const shortcut = name.split('/').pop()!
        if (shortcut !== name) {
          this.aliases.set(shortcut, name)
          logger.debug(`${shortcut} -> ${name}`)
        }
      }
      logger.info(`resolved ${this.aliases.size} aliases.`)
    })
  }

  aliases: Map<string, string> = new Map()

  override lookup(key: string) {
    if (!this.aliases.has(key))
      return Promise.resolve([])
    return this.ctx.dict.lookup(this.aliases.get(key)!)
  }
}

namespace AliasDictSource {
  export interface Config {}
  export const Config: Schema<Config> = Schema.object({})
}

export default AliasDictSource
