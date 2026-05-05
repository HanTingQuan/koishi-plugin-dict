import type { Context } from 'koishi'
import { h, Random, Schema } from 'koishi'

export const inject = ['dict']

export interface Config {
  echo: boolean
  markdown: boolean
  delimiter: string
}

export const Config = Schema.object({
  echo: Schema.boolean().default(true).description('未捕获指令作为填字输出。'),
  markdown: Schema.boolean().default(true).description('启用 Markdown 输出。'),
  delimiter: Schema.string().default(' ').description('默认字段分隔符。'),
})

export function apply(ctx: Context, config: Config) {
  function markdown(content: string) {
    return config.markdown ? h('markdown', content) : content
  }

  ctx.command('look <key...:string>', '查询词典所有结果。')
    .option('delimiter', '-d <delim:string> 分隔符。')
    .option('long', '-l 显示完整结果。')
    .action(async ({ options }, ...key) => {
      const delimiter = options?.delimiter || config.delimiter
      return (await Promise.all(key.map(key => ctx.dict.lookup(key))))
        .map(result => result?.join(delimiter))
        .map((joined, index) => options?.long ? `${key[index]}: ${joined}` : joined)
        .join('\n')
    })

  ctx.command('find <values...:string>', '查找查询字符串的词典。')
    .option('delimiter', '-d <delim:string> 分隔符。')
    .action(async ({ options }, ...values) => {
      const delimiter = options?.delimiter || config.delimiter
      return markdown(Object.entries(await ctx.dict.find(...values))
        .map(([key, founds]) => `${key}: ${founds
          .sort((a, b) => +a.weak - +b.weak)
          .map(found => found.weak
            ? config.markdown ? `*${found.key}*` : `(${found.key})`
            : found.key,
          )
          .join(delimiter)}`)
        .join('\n'))
    })

  function resolve(content: string) {
    return content.replaceAll(/%\(([^()]*)\)/g, (raw, key) =>
      Random.pick(ctx.dict.lookupSync(key) || [raw]))
  }

  config.echo && ctx.middleware((session, next) =>
    next(() => session.content && resolve(session.content)), true)
}
