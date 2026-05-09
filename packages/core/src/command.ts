import type { Context } from 'koishi'
import type { Config } from '.'
import { h } from 'koishi'

export const inject = ['dict']

export function apply(ctx: Context, config: Config) {
  ctx.command('look <keys...:string>', '查询词典所有结果。')
    .option('long', '-l 显示完整结果。')
    .option('prefixed', '-p 添加字典前缀。')
    .action(async ({ session, options }, ...keys) => {
      if (keys.length === 0) {
        return Array.from(ctx.dict.availables)
          .map(name => options?.long ? name : name.split('/').pop())
          .join(' ')
      }
      return (await Promise.all(keys.map(async (key, index) => {
        const result = await ctx.dict.lookup(key)
        if (!result.length)
          return keys[index]
        if (result.extra)
          await session?.send(result.extra)
        const joined = options?.prefixed
          ? result.map(item => `${key}/${item}`).join(' ')
          : result.join(' ')
        return options?.long ? `${keys[index]}: ${joined}` : joined
      }))).join('\n')
    })

  ctx.command('find <values...:string>', '查找查询字符串的词典。')
    .option('markdown', '-m 启用 markdown 输出。')
    .action(async ({ options }, ...values) => {
      const result = Object.entries(await ctx.dict.find(...values))
        .map(([key, founds]) => `${key}: ${founds
          .sort((a, b) => +a.weak - +b.weak)
          .map(found => found.weak
            ? options?.markdown ? `*${found.name}*` : `(${found.name})`
            : found.name,
          )
          .join(' ')}`)
        .join('\n')
      return options?.markdown ? h('markdown', result) : result
    })

  config.echo && ctx.middleware((session, next) =>
    void next(() => session.content && h('markdown', h.parse(
      h.escape(session.content)
        .replaceAll(/%\(([^()]*)\)/g, (_, key) => {
          return `<execute>shuf $(look ${key})</execute>`
        }),
    ))))
}
