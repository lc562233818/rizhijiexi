import type { OperatorConfig } from '../stores/project'

export interface SimulationStep {
  step: number
  operator: string
  operatorLabel: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  changes: string[]
  errors?: string[]
}

export interface SimulationResult {
  steps: SimulationStep[]
  finalOutput: Record<string, unknown>
  success: boolean
  errors: string[]
}

// 模拟执行规则链
export function simulateRuleChain(
  rawLog: string,
  rules: OperatorConfig[]
): SimulationResult {
  const steps: SimulationStep[] = []
  const errors: string[] = []
  
  // 初始输入
  let currentData: Record<string, unknown> = {
    raw_message: rawLog,
    _timestamp: new Date().toISOString(),
  }

  if (!rawLog.trim()) {
    return {
      steps: [],
      finalOutput: currentData,
      success: false,
      errors: ['原始日志为空'],
    }
  }

  rules.forEach((rule, index) => {
    const stepErrors: string[] = []
    const changes: string[] = []
    const input = { ...currentData }
    
    try {
      const output = simulateOperator(rule, currentData, changes, stepErrors)
      currentData = output
      
      steps.push({
        step: index + 1,
        operator: rule.name,
        operatorLabel: getOperatorLabel(rule.name),
        input: sanitizeData(input),
        output: sanitizeData(output),
        changes,
        errors: stepErrors.length > 0 ? stepErrors : undefined,
      })
      
      if (stepErrors.length > 0) {
        errors.push(`步骤 ${index + 1} (${rule.name}): ${stepErrors.join(', ')}`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误'
      stepErrors.push(errorMsg)
      errors.push(`步骤 ${index + 1} (${rule.name}): ${errorMsg}`)
      
      steps.push({
        step: index + 1,
        operator: rule.name,
        operatorLabel: getOperatorLabel(rule.name),
        input: sanitizeData(input),
        output: sanitizeData(currentData),
        changes: [],
        errors: stepErrors,
      })
    }
  })

  return {
    steps,
    finalOutput: sanitizeData(currentData),
    success: errors.length === 0,
    errors,
  }
}

// 模拟单个算子执行
function simulateOperator(
  rule: OperatorConfig,
  data: Record<string, unknown>,
  changes: string[],
  errors: string[]
): Record<string, unknown> {
  const result = { ...data }
  const params = rule.params

  switch (rule.name) {
    case 'grok':
    case 'regex': {
      const sourceField = (params.source_field as string) || 'raw_message'
      const pattern = params.pattern as string
      const sourceValue = String(data[sourceField] || '')
      
      if (!pattern) {
        errors.push('正则表达式为空')
        break
      }
      
      if (!sourceValue) {
        errors.push('源字段为空')
        break
      }
      
      // 将 Grok 模式转换为正则表达式
      let regexPattern = pattern
      
      // 替换 Grok 模式 %{PATTERN:name} 为命名捕获组
      // 常见 Grok 模式映射 - 扩展支持更多模式
      const grokPatterns: Record<string, string> = {
        'IP': '(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})',
        'IPV6': '([0-9a-fA-F:]+)',
        'WORD': '(\\w+)',
        'NUMBER': '([+-]?\\d+(?:\\.\\d+)?)',
        'INT': '(\\d+)',
        'BASE10NUM': '([+-]?\\d+(?:\\.\\d+)?)',
        'DATA': '(.*?)',
        'GREEDYDATA': '([\\s\\S]*?)',
        'NOTSPACE': '(\\S+)',
        'SPACE': '(\\s*)',
        'QUOTEDSTRING': '"([^"]*)"',
        'QS': '"([^"]*)"',
        'HTTPDATE': '(\\d{2}/\\w{3}/\\d{4}:\\d{2}:\\d{2}:\\d{2} [+-]\\d{4})',
        'TIMESTAMP_ISO8601': '(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?[+-]?\\d{2}:?\\d{2})',
        'DATE': '(\\d{4}-\\d{2}-\\d{2})',
        'TIME': '(\\d{2}:\\d{2}:\\d{2})',
        'URI': '(https?://\\S+)',
        'URIPATH': '(/[^\\s]*)',
        'URIPATHPARAM': '(/[^\\s]*)',
        'URIPARAM': '(\\?[^\\s]*)',
        'HTTPMETHOD': '(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)',
        'HTTPVERSION': '(HTTP/\\d\\.\\d)',
        'LOGLEVEL': '(DEBUG|INFO|WARN|ERROR|FATAL|TRACE|debug|info|warn|error|fatal|trace)',
        'HOSTNAME': '([\\w-]+(?:\\.[\\w-]+)*)',
        'HOST': '([\\w-]+(?:\\.[\\w-]+)*)',
        'EMAILLOCALPART': '([\\w._%+-]+)',
        'EMAILADDRESS': '([\\w._%+-]+@[\\w-]+(?:\\.[\\w-]+)*)',
        'USER': '(\\w+)',
        'UUID': '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
        'MAC': '([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})',
        'PATH': '([/\\\\A-Za-z0-9_.-]+)',
        'SYSLOGTIMESTAMP': '(\\w{3}\\s+\\d{1,2}\\s+\\d{2}:\\d{2}:\\d{2})',
        'MONTH': '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)',
        'MONTHNUM': '(0?[1-9]|1[0-2])',
        'MONTHDAY': '(3[01]|[12]\\d|0?[1-9])',
        'YEAR': '(\\d{4})',
        'HOUR': '(2[0123]|[01]?\\d)',
        'MINUTE': '([0-5]\\d)',
        'SECOND': '([0-5]\\d(?:\\.\\d+)?)',
        'ISO8601_TIMEZONE': '(Z|[+-]\\d{2}:\\d{2})',
        'TZ': '([A-Z]{2,4})',
        'PID': '(\\d+)',
        'POSINT': '([1-9]\\d*)',
        'NONNEGINT': '(\\d+)',
      }
      
      // 处理 Grok 模式 %{PATTERN:name}
      const grokRegex = /%\{([A-Z0-9_]+):(\w+)\}/g
      let match: RegExpExecArray | null
      const grokFields: string[] = []
      
      while ((match = grokRegex.exec(pattern)) !== null) {
        const patternName = match[1]
        const fieldName = match[2]
        grokFields.push(fieldName)
        
        const subPattern = grokPatterns[patternName] || '([^\\s]+)'
        regexPattern = regexPattern.replace(match[0], `(?<${fieldName}>${subPattern})`)
      }
      
      // 处理简化 Grok 模式 %{PATTERN}
      const simpleGrokRegex = /%\{([A-Z0-9_]+)\}/g
      while ((match = simpleGrokRegex.exec(pattern)) !== null) {
        const patternName = match[1]
        const subPattern = grokPatterns[patternName] || '([^\\s]+)'
        regexPattern = regexPattern.replace(match[0], subPattern)
      }
      
      // 尝试匹配 - 支持多行模式
      try {
        // 检查是否需要多行匹配
        const isMultiline = sourceValue.includes('\n') && !regexPattern.includes('\\n')
        const regexFlags = isMultiline ? 'm' : ''
        
        // 对于包含多行内容的匹配，添加 s 标志（dotAll）
        const hasDotAll = regexPattern.includes('GREEDYDATA') || regexPattern.includes('.*')
        const finalFlags = hasDotAll ? regexFlags + 's' : regexFlags
        
        const regex = new RegExp(regexPattern, finalFlags)
        const execResult = regex.exec(sourceValue)
        
        if (execResult && execResult.groups) {
          // 提取命名捕获组
          Object.entries(execResult.groups).forEach(([fieldName, value]) => {
            if (value !== undefined) {
              result[fieldName] = value
              changes.push(`提取字段: ${fieldName} = "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`)
            }
          })
        } else if (execResult) {
          // 没有命名组，按位置映射
          grokFields.forEach((fieldName, index) => {
            const value = execResult[index + 1]
            if (value !== undefined) {
              result[fieldName] = value
              changes.push(`提取字段: ${fieldName} = "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`)
            }
          })
        } else {
          errors.push('正则表达式未能匹配日志内容')
        }
      } catch (e) {
        errors.push(`正则表达式编译失败: ${e instanceof Error ? e.message : '未知错误'}`)
      }
      break
    }

    case 'json': {
      const sourceField = (params.source_field as string) || 'raw_message'
      const jsonpath = params.jsonpath as Record<string, string> | undefined
      const sourceValue = String(data[sourceField] || '')
      
      try {
        const parsed = JSON.parse(sourceValue)
        if (jsonpath && typeof jsonpath === 'object') {
          Object.entries(jsonpath).forEach(([fieldName, path]) => {
            const value = getValueByPath(parsed, path as string)
            result[fieldName] = value
            changes.push(`提取字段: ${fieldName} = ${JSON.stringify(value).slice(0, 50)}`)
          })
        } else {
          // 直接展开所有字段
          Object.entries(parsed).forEach(([key, value]) => {
            result[key] = value
            changes.push(`提取字段: ${key}`)
          })
        }
      } catch {
        errors.push('JSON 解析失败')
      }
      break
    }

    case 'csv': {
      const sourceField = (params.source_field as string) || 'raw_message'
      const delimiter = (params.delimiter as string) || ','
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      const sourceValue = String(data[sourceField] || '')
      
      const values = sourceValue.split(delimiter)
      fields.forEach((fieldName, index) => {
        if (fieldName && values[index] !== undefined) {
          result[fieldName] = values[index].trim()
          changes.push(`提取字段: ${fieldName} = ${values[index].trim()}`)
        }
      })
      break
    }

    case 'kv_split': {
      const sourceField = params.source_field as string
      const pairSeparator = (params.pair_separator as string) || '&'
      const kvSeparator = (params.kv_separator as string) || '='
      const sourceValue = String(data[sourceField] || '')
      
      const pairs = sourceValue.split(pairSeparator)
      pairs.forEach(pair => {
        const [key, value] = pair.split(kvSeparator)
        if (key && value !== undefined) {
          result[key.trim()] = value.trim()
          changes.push(`提取字段: ${key.trim()} = ${value.trim()}`)
        }
      })
      break
    }

    case 'xml': {
      // const _sourceField = (params.source_field as string) || 'raw_message'
      const xpath = params.xpath as Record<string, string> | undefined
      changes.push(`解析 XML: ${xpath ? Object.keys(xpath).join(', ') : '全部字段'}`)
      if (xpath && typeof xpath === 'object') {
        Object.entries(xpath).forEach(([fieldName]) => {
          result[fieldName] = `[模拟_XML_${fieldName}_值]`
          changes.push(`提取字段: ${fieldName}`)
        })
      }
      break
    }

    case 'syslog_pri': {
      const sourceField = (params.source_field as string) || 'raw_message'
      const sourceValue = String(data[sourceField] || '')
      const priMatch = sourceValue.match(/^<(\d+)>/)
      if (priMatch) {
        const pri = parseInt(priMatch[1])
        const facility = Math.floor(pri / 8)
        const severity = pri % 8
        result['facility'] = facility
        result['severity'] = severity
        changes.push(`提取 facility: ${facility}`)
        changes.push(`提取 severity: ${severity}`)
      }
      break
    }

    case 'timestamp': {
      const sourceField = params.source_field as string
      const format = params.format as string
      const sourceValue = String(data[sourceField] || '')
      
      result[sourceField] = `[已解析: ${sourceValue}]`
      result['_parsed_timestamp'] = new Date().toISOString()
      changes.push(`解析时间戳: ${sourceField} (${format})`)
      break
    }

    case 'to_number': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      const type = (params.type as string) || 'int'
      fields.forEach(fieldName => {
        if (result[fieldName] !== undefined) {
          const originalValue = String(result[fieldName])
          
          // 检查是否是模拟值（提取阶段产生的占位符）
          const isMockValue = originalValue.includes('[模拟_') || 
                             originalValue.includes('[已') ||
                             (originalValue.startsWith('[') && originalValue.endsWith(']'))
          
          if (isMockValue) {
            // 为模拟值生成合理的示例数值
            let mockNum: number
            if (fieldName.includes('status') || fieldName.includes('code')) {
              mockNum = type === 'int' ? 200 : 200.0
            } else if (fieldName.includes('bytes') || fieldName.includes('size')) {
              mockNum = type === 'int' ? 1024 : 1024.5
            } else if (fieldName.includes('port')) {
              mockNum = type === 'int' ? 8080 : 8080.0
            } else if (fieldName.includes('duration') || fieldName.includes('time')) {
              mockNum = type === 'int' ? 150 : 1.5
            } else if (fieldName.includes('pid')) {
              mockNum = type === 'int' ? 12345 : 12345.0
            } else if (fieldName.includes('count') || fieldName.includes('rows')) {
              mockNum = type === 'int' ? 100 : 100.0
            } else {
              mockNum = type === 'int' ? 42 : 42.5
            }
            result[fieldName] = mockNum
            changes.push(`转换数值: ${fieldName} = ${mockNum} (模拟值)`)
          } else {
            // 正常转换实际值
            const numValue = type === 'int' 
              ? parseInt(originalValue, 10) 
              : parseFloat(originalValue)
            if (!isNaN(numValue)) {
              result[fieldName] = numValue
              changes.push(`转换数值: ${fieldName} = ${numValue}`)
            } else {
              errors.push(`无法将 ${fieldName} 转换为 ${type}`)
            }
          }
        } else {
          // 字段不存在，创建一个模拟数值
          const mockNum = type === 'int' ? 0 : 0.0
          result[fieldName] = mockNum
          changes.push(`创建数值字段: ${fieldName} = ${mockNum}`)
        }
      })
      break
    }

    case 'trim': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      if (fields.length === 0) {
        // 处理所有字段
        Object.keys(result).forEach(key => {
          if (typeof result[key] === 'string') {
            result[key] = String(result[key]).trim()
          }
        })
        changes.push('去除所有字段首尾空白')
      } else {
        fields.forEach(fieldName => {
          if (typeof result[fieldName] === 'string') {
            result[fieldName] = String(result[fieldName]).trim()
            changes.push(`去除空白: ${fieldName}`)
          }
        })
      }
      break
    }

    case 'lowercase': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      fields.forEach(fieldName => {
        if (typeof result[fieldName] === 'string') {
          result[fieldName] = String(result[fieldName]).toLowerCase()
          changes.push(`转小写: ${fieldName}`)
        }
      })
      break
    }

    case 'uppercase': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      fields.forEach(fieldName => {
        if (typeof result[fieldName] === 'string') {
          result[fieldName] = String(result[fieldName]).toUpperCase()
          changes.push(`转大写: ${fieldName}`)
        }
      })
      break
    }

    case 'remove': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      fields.forEach(fieldName => {
        if (fieldName in result) {
          delete result[fieldName]
          changes.push(`删除字段: ${fieldName}`)
        }
      })
      break
    }

    case 'pick': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      const picked: Record<string, unknown> = {}
      fields.forEach(fieldName => {
        if (fieldName in result) {
          picked[fieldName] = result[fieldName]
        }
      })
      Object.keys(result).forEach(key => {
        if (!fields.includes(key)) {
          delete result[key]
          changes.push(`移除字段: ${key}`)
        }
      })
      break
    }

    case 'rename': {
      const mappings = params.mappings as Record<string, string> | undefined
      if (mappings && typeof mappings === 'object') {
        Object.entries(mappings).forEach(([oldName, newName]) => {
          if (oldName in result) {
            result[newName] = result[oldName]
            delete result[oldName]
            changes.push(`重命名字段: ${oldName} -> ${newName}`)
          }
        })
      }
      break
    }

    case 'copy': {
      const sourceField = params.source_field as string
      const targetField = params.target_field as string
      if (sourceField in result) {
        result[targetField] = result[sourceField]
        changes.push(`复制字段: ${sourceField} -> ${targetField}`)
      }
      break
    }

    case 'filter': {
      const condition = params.condition as string
      const action = (params.action as string) || 'keep'
      changes.push(`条件过滤: ${condition} [${action === 'keep' ? '保留' : '丢弃'}]`)
      // 模拟过滤结果
      break
    }

    case 'format': {
      const targetField = params.target_field as string
      const template = params.template as string
      
      // 替换模板中的变量
      let formattedValue = template
      const varMatches = template.match(/\{(\w+)\}/g)
      if (varMatches) {
        varMatches.forEach(match => {
          const varName = match.slice(1, -1)
          const varValue = String(result[varName] || '')
          formattedValue = formattedValue.replace(match, varValue)
        })
      }
      
      result[targetField] = formattedValue
      changes.push(`格式化字段: ${targetField}`)
      break
    }

    case 'url_decode': {
      const sourceField = params.source_field as string
      const targetField = (params.target_field as string) || sourceField
      if (sourceField in result) {
        try {
          result[targetField] = decodeURIComponent(String(result[sourceField]))
          changes.push(`URL 解码: ${sourceField} -> ${targetField}`)
        } catch {
          errors.push(`URL 解码失败: ${sourceField}`)
        }
      }
      break
    }

    case 'ua_parse': {
      const sourceField = params.source_field as string
      const ua = String(result[sourceField] || '')
      
      if (ua) {
        // 简单的 UA 解析逻辑
        let os = 'Unknown'
        let browser = 'Unknown'
        let device = 'Desktop'
        
        // 检测 OS
        if (ua.includes('Windows')) os = 'Windows'
        else if (ua.includes('Mac OS X') || ua.includes('macOS')) os = 'macOS'
        else if (ua.includes('Linux')) os = 'Linux'
        else if (ua.includes('Android')) { os = 'Android'; device = 'Mobile' }
        else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS'; device = 'Mobile' }
        
        // 检测浏览器
        if (ua.includes('Chrome')) browser = 'Chrome'
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
        else if (ua.includes('Firefox')) browser = 'Firefox'
        else if (ua.includes('Edge')) browser = 'Edge'
        else if (ua.includes('MSIE') || ua.includes('Trident')) browser = 'IE'
        
        // 检测设备类型
        if (ua.includes('Mobile')) device = 'Mobile'
        else if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet'
        
        result['os'] = os
        result['browser'] = browser
        result['device'] = device
        changes.push(`解析 User Agent: OS=${os}, Browser=${browser}, Device=${device}`)
      } else {
        result['os'] = 'Unknown'
        result['browser'] = 'Unknown'
        result['device'] = 'Unknown'
        changes.push('解析 User Agent (空值)')
      }
      break
    }

    case 'geo': {
      const sourceField = params.source_field as string
      const prefix = (params.target_prefix as string) || 'geo_'
      const ip = String(result[sourceField] || '')
      
      // 根据 IP 特征返回模拟地理位置
      let country = 'Unknown'
      let city = 'Unknown'
      
      if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        country = 'Private'
        city = 'Local Network'
      } else if (ip.includes(':')) {
        country = 'IPv6'
        city = 'Unknown'
      } else if (ip && ip !== 'undefined') {
        // 模拟一些常见 IP 段
        const ipNum = ip.split('.').map(Number)
        if (ipNum[0] === 8) { country = 'US'; city = 'Ashburn' }
        else if (ipNum[0] === 104) { country = 'US'; city = 'Mountain View' }
        else { country = 'CN'; city = 'Beijing' }
      }
      
      result[`${prefix}country`] = country
      result[`${prefix}city`] = city
      result[`${prefix}latitude`] = 39.9
      result[`${prefix}longitude`] = 116.4
      changes.push(`解析地理位置: ${ip} -> ${country}/${city}`)
      break
    }

    case 'mask': {
      const field = params.field as string
      // const pattern = params.pattern as string
      const replacement = (params.replacement as string) || '****'
      if (field in result) {
        result[field] = replacement
        changes.push(`脱敏字段: ${field}`)
      }
      break
    }

    case 'default': {
      const field = params.field as string
      const value = params.value
      if (!(field in result) || result[field] === '' || result[field] === null || result[field] === undefined) {
        result[field] = value
        changes.push(`设置默认值: ${field} = ${value}`)
      }
      break
    }

    case 'tag': {
      const tags = (params.tags as string)?.split(',').map(t => t.trim()) || []
      result['_tags'] = [...(result['_tags'] as string[] || []), ...tags]
      changes.push(`添加标签: ${tags.join(', ')}`)
      break
    }

    case 'split': {
      const sourceField = params.source_field as string
      const separator = (params.separator as string) || ','
      const targetField = (params.target_field as string) || sourceField
      const limit = params.limit as number | undefined
      
      if (typeof result[sourceField] === 'string') {
        const value = String(result[sourceField])
        const parts = limit ? value.split(separator, limit) : value.split(separator)
        result[targetField] = parts
        changes.push(`分割字符串: ${sourceField} -> ${parts.length} 个元素`)
      }
      break
    }

    case 'join': {
      const sourceField = params.source_field as string
      const separator = (params.separator as string) || ','
      const targetField = (params.target_field as string) || sourceField
      
      if (Array.isArray(result[sourceField])) {
        result[targetField] = (result[sourceField] as unknown[]).join(separator)
        changes.push(`连接数组: ${sourceField} -> ${targetField}`)
      }
      break
    }

    case 'jwt_decode': {
      const jwtSourceField = params.source_field as string
      const jwt = String(result[jwtSourceField] || '')
      try {
        const parts = jwt.split('.')
        if (parts.length === 3) {
          const header = JSON.parse(atob(parts[0]))
          const payload = JSON.parse(atob(parts[1]))
          result['jwt_header'] = header
          result['jwt_payload'] = payload
          changes.push('解码 JWT')
        } else {
          errors.push('无效的 JWT 格式')
        }
      } catch {
        errors.push('JWT 解码失败')
      }
      break
    }

    case 'multiline': {
      const pattern = params.pattern as string
      const negate = (params.negate as boolean) || false
      const what = (params.what as string) || 'previous'
      const sourceField = params.source_field as string || 'raw_message'
      
      if (!pattern) {
        errors.push('行首匹配模式为空')
        break
      }
      
      // 获取原始消息，处理转义的换行符
      let rawMessage = String(data[sourceField] || '')
      
      // 将字面量 \n 转换为真正的换行符
      rawMessage = rawMessage.replace(/\\n/g, '\n')
      
      if (!rawMessage.includes('\n')) {
        changes.push('单条日志，无需合并')
        break
      }
      
      try {
        const lines = rawMessage.split('\n')
        const linePattern = new RegExp(pattern)
        const mergedLines: string[] = []
        let currentLine = ''
        
        lines.forEach((line) => {
          const trimmedLine = line.trim()
          if (!trimmedLine) return // 跳过空行
          
          const isNewLog = negate ? !linePattern.test(trimmedLine) : linePattern.test(trimmedLine)
          
          if (isNewLog) {
            // 这是新日志的开始
            if (currentLine) {
              mergedLines.push(currentLine.trim())
            }
            currentLine = trimmedLine
          } else {
            // 这是续行
            if (what === 'previous') {
              currentLine += ' ' + trimmedLine
            } else {
              // next - 暂存，等下一条新日志开始后再处理
              currentLine += '\n' + trimmedLine
            }
          }
        })
        
        // 添加最后一条
        if (currentLine) {
          mergedLines.push(currentLine.trim())
        }
        
        // 更新结果
        const targetField = params.target_field as string || sourceField
        result[targetField] = mergedLines[0] || rawMessage
        result['_multiline_count'] = mergedLines.length
        result['_multiline_merged'] = mergedLines
        
        changes.push(`多行合并: ${lines.length} 行 -> ${mergedLines.length} 条日志`)
      } catch (e) {
        errors.push(`多行合并失败: ${e instanceof Error ? e.message : '未知错误'}`)
      }
      break
    }

    default: {
      changes.push(`执行: ${rule.name}`)
    }
  }

  return result
}

// 根据路径获取对象值
function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || !obj) return undefined
  
  // 处理 JSONPath 格式 $.a.b 或 $['a']['b']
  const cleanPath = path.replace(/^\$\.?/, '').replace(/\['?(\w+)'?\]/g, '.$1')
  const keys = cleanPath.split('.').filter(Boolean)
  
  let result: unknown = obj
  for (const key of keys) {
    if (result === null || result === undefined) return undefined
    if (typeof result !== 'object') return undefined
    result = (result as Record<string, unknown>)[key]
  }
  return result
}

// 获取算子标签
function getOperatorLabel(name: string): string {
  const labels: Record<string, string> = {
    regex: '正则解析',
    grok: 'Grok 解析',
    delimiter: '分隔符拆分',
    kv_split: 'KeyValue 分解',
    kv_regex: 'KeyValue 正则匹配',
    csv: 'CSV 解析',
    json: 'JSON 解析',
    xml: 'XML 解析',
    syslog_pri: 'Syslog_pri 解析',
    struct: '结构体解析',
    expand: 'Expand 多行拆分',
    multiline: '多行合并',
    cef: 'CEF 解析',
    leef: 'LEEF 解析',
    jwt_decode: 'JWT 解码',
    parse_query_string: 'QueryString 解析',
    parse_cookie: 'Cookie 解析',
    to_number: '数值型字段转换',
    url_decode: 'URL 解码',
    timestamp: '时间戳识别',
    ip_convert: 'IP 格式转换',
    hex: 'Hex 转换',
    format: '格式化处理',
    trim: '去除空白',
    lowercase: '转小写',
    uppercase: '转大写',
    substring: '子字符串',
    split: '字符串分割',
    round: '数值取整',
    hash: '哈希计算',
    bytes_convert: '字节转换',
    calc: '数值计算',
    base64: 'Base64 编解码',
    join: '数组连接',
    flatten: '对象扁平化',
    gzip_decompress: 'Gzip 解压',
    range: '范围标记',
    translate: '文本翻译',
    summarize: '文本摘要',
    ua_parse: 'User Agent 解析',
    url_parse: 'URL 解析',
    dict_expand: '字典扩展',
    replace: '内容替换',
    phone_parse: '号码解析',
    geo: 'Geo 解析',
    mask: '脱敏配置',
    cidr_lookup: 'CIDR 匹配',
    anonymize_ip: 'IP 匿名化',
    remove: '删除字段',
    pick: '字段选择',
    omit: '字段排除',
    rename: '字段重命名',
    copy: '复制字段',
    filter: '条件过滤',
    dedup: '去重处理',
    fingerprint: '指纹生成',
    aggregate: '聚合统计',
    redirect: '重定向解析',
    script: 'Script 解析',
    udf: 'UDF 规则',
    default: '默认值',
    unique: '数组去重',
    set: '设置字段',
    tag: '添加标签',
    sample: '采样',
  }
  return labels[name] || name
}

// 清理数据，移除内部字段
function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  Object.entries(data).forEach(([key, value]) => {
    // 跳过内部字段
    if (key.startsWith('_') && key !== '_tags') return
    result[key] = value
  })
  return result
}

// 高性能版本的日志解析 - 用于批量解析，不记录中间步骤
export function parseLogFast(
  rawLog: string,
  rules: OperatorConfig[]
): Record<string, unknown> | null {
  if (!rawLog.trim()) return null
  
  let currentData: Record<string, unknown> = {
    raw_message: rawLog,
    _timestamp: new Date().toISOString(),
  }
  
  for (const rule of rules) {
    try {
      currentData = applyOperatorFast(rule, currentData)
    } catch {
      // 忽略错误，继续处理下一条规则
    }
  }
  
  return sanitizeData(currentData)
}

// 高性能版本的算子执行 - 不记录变化
function applyOperatorFast(
  rule: OperatorConfig,
  data: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...data }
  const params = rule.params
  
  switch (rule.name) {
    case 'grok':
    case 'regex': {
      const sourceField = (params.source_field as string) || 'raw_message'
      const pattern = params.pattern as string
      const sourceValue = String(data[sourceField] || '')
      
      if (!pattern || !sourceValue) return result
      
      let regexPattern = pattern
      
      // Grok 模式映射
      const grokPatterns: Record<string, string> = {
        'IP': '(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})',
        'IPV6': '([0-9a-fA-F:]+)',
        'WORD': '(\\w+)',
        'NUMBER': '([+-]?\\d+(?:\\.\\d+)?)',
        'INT': '(\\d+)',
        'DATA': '(.*?)',
        'GREEDYDATA': '([\\s\\S]*?)',
        'NOTSPACE': '(\\S+)',
        'QUOTEDSTRING': '"([^"]*)"',
        'HTTPDATE': '(\\d{2}/\\w{3}/\\d{4}:\\d{2}:\\d{2}:\\d{2} [+-]\\d{4})',
        'TIMESTAMP_ISO8601': '(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?[+-]?\\d{2}:?\\d{2})',
        'URI': '(https?://\\S+)',
        'URIPATH': '(/[^\\s]*)',
        'HTTPMETHOD': '(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)',
        'HTTPVERSION': '(HTTP/\\d\\.\\d)',
        'LOGLEVEL': '(DEBUG|INFO|WARN|ERROR|FATAL)',
      }
      
      // 处理 Grok 模式
      const grokRegex = /%\{([A-Z0-9_]+):(\w+)\}/g
      let match: RegExpExecArray | null
      while ((match = grokRegex.exec(pattern)) !== null) {
        const patternName = match[1]
        const fieldName = match[2]
        const subPattern = grokPatterns[patternName] || '([^\\s]+)'
        regexPattern = regexPattern.replace(match[0], `(?<${fieldName}>${subPattern})`)
      }
      
      // 处理简化 Grok 模式
      const simpleGrokRegex = /%\{([A-Z0-9_]+)\}/g
      while ((match = simpleGrokRegex.exec(pattern)) !== null) {
        const patternName = match[1]
        const subPattern = grokPatterns[patternName] || '([^\\s]+)'
        regexPattern = regexPattern.replace(match[0], subPattern)
      }
      
      try {
        const isMultiline = sourceValue.includes('\n') && !regexPattern.includes('\\n')
        const hasDotAll = regexPattern.includes('GREEDYDATA') || regexPattern.includes('.*')
        const finalFlags = (isMultiline ? 'm' : '') + (hasDotAll ? 's' : '')
        
        const regex = new RegExp(regexPattern, finalFlags)
        const execResult = regex.exec(sourceValue)
        
        if (execResult?.groups) {
          Object.assign(result, execResult.groups)
        }
      } catch {
        // 忽略正则错误
      }
      break
    }
    
    case 'json': {
      const sourceField = (params.source_field as string) || 'raw_message'
      try {
        const parsed = JSON.parse(String(data[sourceField] || ''))
        const jsonpath = params.jsonpath as Record<string, string> | undefined
        if (jsonpath) {
          Object.entries(jsonpath).forEach(([fieldName, path]) => {
            result[fieldName] = getValueByPath(parsed, path as string)
          })
        } else {
          Object.assign(result, parsed)
        }
      } catch {
        // 忽略 JSON 解析错误
      }
      break
    }
    
    case 'csv': {
      const delimiter = (params.delimiter as string) || ','
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      const sourceField = (params.source_field as string) || 'raw_message'
      const values = String(data[sourceField] || '').split(delimiter)
      fields.forEach((field, index) => {
        if (values[index] !== undefined) {
          result[field] = values[index].trim()
        }
      })
      break
    }
    
    case 'timestamp': {
      const sourceField = params.source_field as string
      if (sourceField && result[sourceField]) {
        result['@timestamp'] = result[sourceField]
      }
      break
    }
    
    case 'to_number': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      const type = (params.type as string) || 'int'
      fields.forEach(field => {
        if (result[field] !== undefined) {
          const numValue = type === 'int' 
            ? parseInt(String(result[field]), 10)
            : parseFloat(String(result[field]))
          if (!isNaN(numValue)) {
            result[field] = numValue
          }
        }
      })
      break
    }
    
    case 'remove': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      fields.forEach(field => {
        delete result[field]
      })
      break
    }
    
    case 'rename': {
      const mappings = params.mappings as Record<string, string>
      if (mappings) {
        Object.entries(mappings).forEach(([oldKey, newKey]) => {
          if (result[oldKey] !== undefined) {
            result[newKey] = result[oldKey]
            delete result[oldKey]
          }
        })
      }
      break
    }
    
    case 'trim': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      if (fields.length === 0) {
        Object.keys(result).forEach(key => {
          if (typeof result[key] === 'string') {
            result[key] = String(result[key]).trim()
          }
        })
      } else {
        fields.forEach(field => {
          if (typeof result[field] === 'string') {
            result[field] = String(result[field]).trim()
          }
        })
      }
      break
    }
    
    case 'lowercase':
    case 'uppercase': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      const transform = rule.name === 'lowercase' 
        ? (s: string) => s.toLowerCase()
        : (s: string) => s.toUpperCase()
      fields.forEach(field => {
        if (typeof result[field] === 'string') {
          result[field] = transform(String(result[field]))
        }
      })
      break
    }
    
    case 'ua_parse': {
      const sourceField = params.source_field as string
      const ua = String(result[sourceField] || '')
      if (ua) {
        let os = 'Unknown', browser = 'Unknown', device = 'Desktop'
        if (ua.includes('Chrome')) browser = 'Chrome'
        else if (ua.includes('Firefox')) browser = 'Firefox'
        else if (ua.includes('Safari')) browser = 'Safari'
        if (ua.includes('Windows')) os = 'Windows'
        else if (ua.includes('Mac')) os = 'macOS'
        else if (ua.includes('Linux')) os = 'Linux'
        else if (ua.includes('Mobile')) { os = 'Mobile'; device = 'Mobile' }
        result['os'] = os
        result['browser'] = browser
        result['device'] = device
      }
      break
    }
    
    case 'geo': {
      const sourceField = params.source_field as string
      const targetPrefix = params.target_prefix as string
      const value = result[sourceField] as string
      if (value && targetPrefix) {
        result[`${targetPrefix}country`] = 'Unknown'
        result[`${targetPrefix}city`] = 'Unknown'
      }
      break
    }
    
    case 'format': {
      const targetField = params.target_field as string
      const template = params.template as string
      if (targetField && template) {
        let formatted = template
        template.match(/\{(\w+)\}/g)?.forEach((match) => {
          const key = match.slice(1, -1)
          formatted = formatted.replace(match, String(result[key] ?? ''))
        })
        result[targetField] = formatted
      }
      break
    }
    
    case 'url_decode': {
      const sourceField = params.source_field as string
      const targetField = (params.target_field as string) || sourceField
      if (sourceField in result) {
        try {
          result[targetField] = decodeURIComponent(String(result[sourceField]))
        } catch {
          // 忽略解码错误
        }
      }
      break
    }
    
    case 'add_fields': {
      const fields = params.fields as Record<string, unknown>
      if (fields) {
        Object.assign(result, fields)
      }
      break
    }
  }
  
  return result
}
