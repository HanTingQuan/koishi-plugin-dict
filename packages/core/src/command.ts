import type { Context } from 'koishi'
import { Random, Schema } from 'koishi'

export const inject = ['dict']

export interface Config {
  delimiter: string
}

export const Config = Schema.object({
  delimiter: Schema.string().default(' ').description('默认字段分隔符。'),
})

export function apply(ctx: Context, config: Config) {
  ctx.command('look <key:string>', '查询词典所有结果。')
    .option('delimiter', '-d <delim:string> 分隔符。')
    .action(async ({ options }, key) => {
      const delimiter = options?.delimiter || config.delimiter
      if (!key)
        return (await ctx.dict.availables()).join(delimiter)
      const result = await ctx.dict.lookup(key)
      return result ? result.join(delimiter) : '未找到该词典。'
    })

  ctx.command('find <values...:string>', '查找查询字符串的词典。')
    .option('delimiter', '-d <delim:string> 分隔符。')
    .action(async ({ options }, ...values) => {
      const delimiter = options?.delimiter || config.delimiter
      return Object.entries(await ctx.dict.find(...values))
        .map(([key, values]) => `${key}: ${values.join(delimiter)}`)
        .join('\n')
    })

  function resolve(content: string) {
    return content.replaceAll(/%\(([^()]*)\)/g, (raw, key) =>
      Random.pick(ctx.dict.lookupSync(key) || [raw]))
  }

  ctx.middleware((session, next) =>
    next(() => session.content && resolve(session.content)), true)
}
