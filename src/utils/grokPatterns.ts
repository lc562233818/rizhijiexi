// Grok 预定义正则模式库
// 类似 Logstash 的 Grok 过滤器

export interface GrokPattern {
  name: string
  pattern: string
  description: string
}

export const grokPatterns: GrokPattern[] = [
  // 通用基础模式
  { name: 'WORD', pattern: '\\b\\w+\\b', description: '单词字符' },
  { name: 'NUMBER', pattern: '(?:[+-]?(?:(?:\\d+)|(?:\\d+\\.\\d*)|(?:\\d*\\.\\d+)))', description: '数字（整数或小数）' },
  { name: 'INT', pattern: '(?:[+-]?(?:\\d+))', description: '整数' },
  { name: 'BASE10NUM', pattern: '(?<![0-9.+-])(?>[+-]?(?:(?:[0-9]+(?:\\.[0-9]+)?)|(?:\\.[0-9]+)))', description: '十进制数' },
  { name: 'BASE16NUM', pattern: '(?<![0-9A-Fa-f])(?:[+-]?(?:0x)?(?:[0-9A-Fa-f]+))', description: '十六进制数' },
  
  // 空白字符
  { name: 'SPACE', pattern: '\\s*', description: '零个或多个空白字符' },
  { name: 'NOTSPACE', pattern: '\\S+', description: '一个或多个非空白字符' },
  { name: 'DATA', pattern: '.*?', description: '任意字符（非贪婪）' },
  { name: 'GREEDYDATA', pattern: '.*', description: '任意字符（贪婪）' },
  
  // 引号字符串
  { name: 'QUOTEDSTRING', pattern: '(?>(?<!\\)(?>"(?:\\\\|\\"|[^"])*"|\'(?:\\\\|\'|[^\'])*\'|\`(?:\\\\|\`|[^\`])*\`))', description: '带引号的字符串' },
  
  // IP 地址
  { name: 'IP', pattern: '(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)', description: 'IPv4 地址' },
  { name: 'IPV6', pattern: '((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:)))(%.+)?', description: 'IPv6 地址' },
  
  // 主机名和路径
  { name: 'HOSTNAME', pattern: '\\b(?:[0-9A-Za-z][0-9A-Za-z-]{0,62})(?:\\.(?:[0-9A-Za-z][0-9A-Za-z-]{0,62}))*(\\.?|\\b)', description: '主机名' },
  { name: 'HOST', pattern: '(?:%{HOSTNAME})', description: '主机名（别名）' },
  { name: 'PATH', pattern: '(?>[\\/A-Za-z0-9_.-]+)', description: '文件路径' },
  { name: 'URIPROTO', pattern: '[A-Za-z]+(\\+[A-Za-z+]+)?', description: 'URI 协议' },
  { name: 'URIHOST', pattern: '(?:(?:%{IP}(?::%{POSINT})?)|(?:%{HOSTNAME}(?::%{POSINT})?))', description: 'URI 主机' },
  { name: 'URIPATH', pattern: '(?:/[\\A-Za-z0-9$.+!*\'(),~#%-]*)+', description: 'URI 路径' },
  { name: 'URIPARAM', pattern: '\\?(?:[A-Za-z0-9$.+!*\'|(),~#%&/=:;*-]*)?', description: 'URI 参数' },
  { name: 'URI', pattern: '(?:%{URIPROTO}://(?:%{USER}(?::[^@]*)?@)?(?:%{URIHOST})?(?:%{URIPATH}(?:\\?%{URIPARAM})?)?)', description: '完整 URI' },
  
  // 时间和日期
  { name: 'MONTH', pattern: '\\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\b', description: '月份名称' },
  { name: 'MONTHNUM', pattern: '(?:0?[1-9]|1[0-2])', description: '月份数字 (1-12)' },
  { name: 'MONTHNUM2', pattern: '(?:0[1-9]|1[0-2])', description: '月份数字 (01-12)' },
  { name: 'MONTHDAY', pattern: '(?:(?:3[01])|(?:[12][0-9])|(?:0?[1-9]))', description: '日期 (1-31)' },
  { name: 'YEAR', pattern: '(?:(?:\\d\\d){1,2})', description: '年份' },
  { name: 'DAY', pattern: '(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)', description: '星期名称' },
  { name: 'HOUR', pattern: '(?:2[0123]|[01]?[0-9])', description: '小时 (0-23)' },
  { name: 'MINUTE', pattern: '(?:[0-5][0-9])', description: '分钟 (0-59)' },
  { name: 'SECOND', pattern: '(?:(?:[0-5]?[0-9]|60)(?:[:.,][0-9]+)?)', description: '秒 (0-60)' },
  { name: 'TIME', pattern: '(?:(?!0{1,6})%{HOUR}:%{MINUTE}(?::%{SECOND})(?:\\s*%{ISO8601_TIMEZONE})?)', description: '时间 (HH:MM:SS)' },
  { name: 'DATE_US', pattern: '%{MONTHNUM}[/-]%{MONTHDAY}[/-]%{YEAR}', description: '美国日期格式' },
  { name: 'DATE_EU', pattern: '%{MONTHDAY}[./-]%{MONTHNUM}[./-]%{YEAR}', description: '欧洲日期格式' },
  { name: 'ISO8601_TIMEZONE', pattern: '(?:Z|[+-]%{HOUR}(?::?%{MINUTE}))', description: 'ISO8601 时区' },
  { name: 'ISO8601_SECOND', pattern: '(?:%{SECOND}|60)', description: 'ISO8601 秒（支持闰秒）' },
  { name: 'TIMESTAMP_ISO8601', pattern: '%{YEAR}-%{MONTHNUM2}-%{MONTHDAY}[T ]%{HOUR}:?%{MINUTE}(?::?%{SECOND})?%{ISO8601_TIMEZONE}?', description: 'ISO8601 时间戳' },
  { name: 'DATE', pattern: '%{DATE_US}|%{DATE_EU}', description: '日期格式' },
  { name: 'DATESTAMP', pattern: '%{DATE}[- ]%{TIME}', description: '完整日期时间' },
  { name: 'HTTPDATE', pattern: '%{MONTHDAY}/%{MONTH}/%{YEAR}:%{TIME} %{INT}', description: 'HTTP 日志日期格式' },
  
  // Syslog
  { name: 'SYSLOGTIMESTAMP', pattern: '%{MONTH} +%{MONTHDAY} %{TIME}', description: 'Syslog 时间戳' },
  { name: 'PROG', pattern: '[\\x21\\x23-\\x5b\\x5d-\\x7e]+', description: '程序名称' },
  { name: 'SYSLOGPROG', pattern: '%{PROG:program}(?:\\[%{POSINT:pid}\\])?', description: 'Syslog 程序（含 PID）' },
  
  // HTTP
  { name: 'HTTPDUSER', pattern: '%{EMAILADDRESS}|%{USER}', description: 'HTTP 认证用户' },
  { name: 'USER', pattern: '[a-zA-Z0-9._-]+', description: '用户名' },
  { name: 'EMAILLOCALPART', pattern: '[a-zA-Z][a-zA-Z0-9_.+-=:]+', description: '邮箱本地部分' },
  { name: 'EMAILADDRESS', pattern: '%{EMAILLOCALPART}@%{HOSTNAME}', description: '完整邮箱地址' },
  { name: 'HTTPMETHOD', pattern: '(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)', description: 'HTTP 方法' },
  { name: 'HTTPVERSION', pattern: 'HTTP/\\d+(?:\\.\\d+)?', description: 'HTTP 版本' },
  
  // Web 服务器
  { name: 'COMMONAPACHELOG', pattern: '%{IPORHOST:clientip} %{HTTPDUSER:ident} %{HTTPDUSER:auth} \\[%{HTTPDATE:timestamp}\\] "(?:%{WORD:verb} %{NOTSPACE:request}(?: HTTP/%{NUMBER:httpversion})?|%{DATA:rawrequest})" %{NUMBER:response} (?:%{NUMBER:bytes}|-)', description: 'Apache 通用日志格式' },
  { name: 'COMBINEDAPACHELOG', pattern: '%{COMMONAPACHELOG} %{QS:referrer} %{QS:agent}', description: 'Apache 组合日志格式' },
  { name: 'HTTPD20_ERRORLOG', pattern: '\\[%{HTTPDERROR_DATE:timestamp}\\] \\[%{LOGLEVEL:loglevel}\\] (?:\\[client %{IPORHOST:client}\\] )%{GREEDYDATA:message}', description: 'Apache 2.0 错误日志' },
  { name: 'HTTPD24_ERRORLOG', pattern: '\\[%{HTTPDERROR_DATE:timestamp}\\] \\[%{WORD:module}:%{LOGLEVEL:loglevel}\\] \\[pid %{POSINT:pid}(:tid %{POSINT:tid})?\\] (?:\\[client %{IPORHOST:client}\\] )?(?:%{GREEDYDATA:message})', description: 'Apache 2.4 错误日志' },
  { name: 'HTTPD_ERRORLOG', pattern: '%{HTTPD20_ERRORLOG}|%{HTTPD24_ERRORLOG}', description: 'Apache 错误日志（通用）' },
  
  // 日志级别
  { name: 'LOGLEVEL', pattern: '([A-a]lert|ALERT|[T|t]race|TRACE|[D|d]ebug|DEBUG|[N|n]otice|NOTICE|[I|i]nfo|INFO|[W|w]arn?(?:ing)?|WARN?(?:ING)?|[E|e]rr?(?:or)?|ERR?(?:OR)?|[C|c]rit?(?:ical)?|CRIT?(?:ICAL)?|[F|f]atal|FATAL|[S|s]evere|SEVERE|EMERG(?:ENCY)?|[Ee]merg(?:ency)?)', description: '日志级别' },
  
  // 常用组合
  { name: 'POSINT', pattern: '\\b(?:[1-9][0-9]*)\\b', description: '正整数' },
  { name: 'NONNEGINT', pattern: '\\b(?:[0-9]+)\\b', description: '非负整数' },
  { name: 'WORD', pattern: '\\b\\w+\\b', description: '单词' },
  { name: 'NOTSPACE', pattern: '\\S+', description: '非空白字符' },
  { name: 'SPACE', pattern: '\\s*', description: '空白字符' },
  { name: 'DATA', pattern: '.*?', description: '任意数据（非贪婪）' },
  { name: 'GREEDYDATA', pattern: '.*', description: '任意数据（贪婪）' },
  { name: 'QS', pattern: '%{QUOTEDSTRING}', description: '带引号字符串（缩写）' },
  { name: 'UUID', pattern: '[A-Fa-f0-9]{8}-(?:[A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12}', description: 'UUID' },
  { name: 'MAC', pattern: '(?:%{CISCOMAC}|%{WINDOWSMAC}|%{COMMONMAC})', description: 'MAC 地址' },
  { name: 'CISCOMAC', pattern: '(?:(?:[A-Fa-f0-9]{4}\\.){2}[A-Fa-f0-9]{4})', description: 'Cisco MAC 格式' },
  { name: 'WINDOWSMAC', pattern: '(?:(?:[A-Fa-f0-9]{2}-){5}[A-Fa-f0-9]{2})', description: 'Windows MAC 格式' },
  { name: 'COMMONMAC', pattern: '(?:(?:[A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2})', description: '通用 MAC 格式' },
  { name: 'IPORHOST', pattern: '(?:%{IP}|%{HOSTNAME})', description: 'IP 或主机名' },
  { name: 'HOSTPORT', pattern: '(?:%{IPORHOST}:%{POSINT})', description: '主机:端口' },
]

// 获取 Grok 模式
export function getGrokPattern(name: string): GrokPattern | undefined {
  return grokPatterns.find((p) => p.name === name)
}

// 编译 Grok 表达式，将 %{PATTERN:field} 转换为实际正则
export function compileGrok(expression: string): string {
  let result = expression
  
  // 处理 %{PATTERN:field:datatype} 格式
  const patternRegex = /%{([A-Z_]+)(?::([^:}]+))?(?::([^}]+))?}/g
  
  result = result.replace(patternRegex, (match, patternName, fieldName, _dataType) => {
    const pattern = getGrokPattern(patternName)
    if (pattern) {
      // 递归编译模式（支持嵌套）
      const compiledPattern = compileGrok(pattern.pattern)
      if (fieldName) {
        // 命名捕获组
        return `(?<${fieldName}>${compiledPattern})`
      }
      return compiledPattern
    }
    // 如果模式不存在，返回原始文本
    return match
  })
  
  return result
}

// 获取常用模式列表（用于 UI 展示）
export function getCommonPatterns(): GrokPattern[] {
  const commonNames = [
    'IP', 'IPV6', 'HOSTNAME', 'HOST', 'URI', 'URIPATH', 'URIPARAM',
    'TIMESTAMP_ISO8601', 'HTTPDATE', 'SYSLOGTIMESTAMP', 'DATE', 'TIME',
    'HTTPMETHOD', 'HTTPVERSION', 'QS', 'LOGLEVEL',
    'COMMONAPACHELOG', 'COMBINEDAPACHELOG',
    'UUID', 'MAC', 'EMAILADDRESS',
    'POSINT', 'INT', 'NUMBER', 'WORD', 'DATA', 'GREEDYDATA'
  ]
  
  return commonNames
    .map((name) => getGrokPattern(name))
    .filter((p): p is GrokPattern => p !== undefined)
}
