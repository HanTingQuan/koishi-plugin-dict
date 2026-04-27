import type { Context } from 'koishi'
import type { Config } from '.'

export const inject = ['dict']

export function apply(ctx: Context, config: Config) {
  ctx.command('look <key:string>', '查询词典所有结果。')
    .option('delimiter', '-d <delim:string> 分隔符。')
    .action(async ({ options }, key) => {
      const delimiter = options?.delimiter || config.delimiter
      const result = await ctx.dict.lookup(key)
      return result ? result.join(delimiter) : '未找到该词典。'
    })

  ctx.command('find <value:string...>', '查找查询字符串的词典。')
    .option('delimiter', '-d <delim:string> 分隔符。')
    .action(async ({ options }, ...value) => {
      const delimiter = options?.delimiter || config.delimiter
      return Object.entries(await ctx.dict.find(...value))
        .map(([key, values]) => `${key} ${values.join(delimiter)}`)
        .join(delimiter)
    })
}
