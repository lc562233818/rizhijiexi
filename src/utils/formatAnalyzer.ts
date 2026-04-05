export type LogFormat = 'json' | 'xml' | 'csv' | 'kv' | 'syslog' | 'nginx' | 'plain'

export interface FormatAnalysis {
  format: LogFormat
  confidence: number // 0-1
  reasons: string[]
}

export function analyzeLogFormat(rawLog: string): FormatAnalysis {
  const trimmed = rawLog.trim()
  if (!trimmed) {
    return { format: 'plain', confidence: 0, reasons: ['空日志'] }
  }

  const firstLine = trimmed.split('\n')[0].trim()

  // JSON
  if ((firstLine.startsWith('{') && firstLine.endsWith('}')) || (firstLine.startsWith('[') && firstLine.endsWith(']'))) {
    try {
      JSON.parse(firstLine)
      return { format: 'json', confidence: 0.95, reasons: ['以 { 或 [ 开头并结尾，且可解析为 JSON'] }
    } catch {
      // ignore
    }
  }

  // XML
  if (firstLine.startsWith('<?xml') || (firstLine.startsWith('<') && firstLine.endsWith('>'))) {
    return { format: 'xml', confidence: 0.85, reasons: ['包含 XML 标签结构'] }
  }

  // Syslog
  if (/^<\d+>/.test(firstLine)) {
    return { format: 'syslog', confidence: 0.9, reasons: ['检测到 PRI 前缀 <123>'] }
  }

  // Nginx / Common Web Log
  if (/\d+\.\d+\.\d+\.\d+.*\[.*\].*"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/.test(firstLine)) {
    return { format: 'nginx', confidence: 0.88, reasons: ['包含 IP、时间戳、HTTP 方法等 Web 日志特征'] }
  }

  // KV
  if (/\w+=[^&=\s]+(&\w+=[^&=\s]+)+/.test(firstLine)) {
    return { format: 'kv', confidence: 0.8, reasons: ['检测到 key=value&key2=value2 键值对结构'] }
  }

  // CSV
  const commaCount = (firstLine.match(/,/g) || []).length
  if (commaCount >= 2 && !firstLine.includes('=')) {
    return { format: 'csv', confidence: 0.7, reasons: [`包含 ${commaCount} 个逗号分隔符，疑似 CSV`] }
  }

  return { format: 'plain', confidence: 0.5, reasons: ['未识别出明显结构，建议使用正则解析'] }
}
