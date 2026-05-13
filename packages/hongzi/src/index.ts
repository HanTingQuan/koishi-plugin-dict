import type { Context } from 'koishi'
import type { Found } from 'koishi-plugin-dict'
import {} from '@koishijs/plugin-help'
import { Argv, h, Logger, Schema } from 'koishi'
import { DictSource } from 'koishi-plugin-dict'

const logger = new Logger('dict-hongzi')

class HongziDictSource extends DictSource {
  static name = 'dict-hongzi'

  availables: string[] = []

  constructor(ctx: Context, public config: HongziDictSource.Config) {
    super(ctx)

    ctx.on('ready', async () => {
      this.availables = await ctx.http.get(`${this.config.endpoint}/list`)
      logger.info(`indexed ${this.availables.length} dicts`)
      ctx.emit('dict-added', ...this.availables)
    })

    ctx.on('dispose', () => {
      ctx.emit('dict-removed', ...this.availables)
    })

    const hongzi = ctx.command('hongzi <message:text>', '薨机的填字。')
      .option('debug', '-d 显示调用栈。')
      .action(async ({ session, options }, message) => {
        if (!message.includes('[[') || !message.includes(']]'))
          return message
        const debug = (options ??= {}).debug
        delete options.debug
        const url = `${this.config.endpoint}/translate`
        const { translated, callstack } = await ctx.http.post(url, {
          text: message,
          variables: options,
        })
        if (debug)
          session?.send(callstack)
        return h.text(translated)
      })

    Argv.interpolate('[[', ']]', (raw) => {
      const source = h.unescape(raw)
      let index = 0
      for (let depth = 1; index < source.length; index++) {
        const current = source[index]
        if (current === '[[')
          depth++
        else if (current === ']]' && --depth === 0)
          break
      }
      const result = source.slice(0, index - 2)
      if (!result) {
        const index = raw.indexOf(']]')
        if (index >= 0)
          return { source: raw, rest: raw.slice(index + 2), tokens: [] }
        return { source: raw, rest: '', tokens: [] }
      }
      return {
        source: result,
        command: hongzi,
        args: [result],
        rest: h.escape(source.slice(result.length + 2)),
      }
    })
  }

  override async lookup(name: string): Promise<string[]> {
    if (!this.availables.includes(name))
      return []
    const url = `${this.config.endpoint}/list/${encodeURIComponent(name)}`
    return await this.ctx.http.get(url)
  }

  async find(values: string[], founds: Record<string, Found[]>) {
    for (const value of values) {
      const result: string[] = await this.ctx.http
        .get(`${this.config.endpoint}/find/${encodeURIComponent(value)}`)
      founds[value].push(...result.map(name => ({ name, weak: false })))
    }
  }
}

namespace HongziDictSource {
  export interface Config {
    endpoint: string
  }

  export const Config: Schema<Config> = Schema.object({
    endpoint: Schema.transform(
      Schema.string().role('url'),
      url => url.replace(/\/$/, ''),
    ).default('http://pbhh.net:8426').description('字典接口地址。'),
  })
}

export default HongziDictSource
