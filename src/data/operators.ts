// 算子定义文件

export interface ParamMeta {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'textarea' | 'select' | 'keyValue'
  required?: boolean
  defaultValue?: unknown
  options?: { label: string; value: string }[]
  placeholder?: string
}

export interface OperatorMeta {
  name: string
  label: string
  category: string
  description: string
  params: ParamMeta[]
}

export const categories = [
  { key: 'extraction', label: '基础提取与拆分' },
  { key: 'conversion', label: '类型转换与格式化' },
  { key: 'enrichment', label: '数据丰富与内容处理' },
  { key: 'advanced', label: '字段操作与高级处理' },
]

export const operators: OperatorMeta[] = [
  // 1. 基础提取与拆分
  {
    name: 'regex',
    label: '正则解析',
    category: 'extraction',
    description: '使用正则表达式及内置宏抽取字段',
    params: [
      { key: 'pattern', label: '正则表达式', type: 'textarea', required: true, placeholder: '例: %{IP:client_ip} .* "(?<method>\\w+)' },
      { key: 'source_field', label: '源字段', type: 'string', defaultValue: 'raw_message', placeholder: '默认 raw_message' },
      { key: 'multiline', label: '多行模式', type: 'boolean', defaultValue: false },
      { key: 'ignore_case', label: '忽略大小写', type: 'boolean', defaultValue: false },
    ],
  },
  {
    name: 'grok',
    label: 'Grok 解析',
    category: 'extraction',
    description: '使用预定义正则宏解析日志（类似 Logstash）',
    params: [
      { key: 'pattern', label: 'Grok 表达式', type: 'textarea', required: true, placeholder: '例: %{IP:client_ip} - - \\[%{HTTPDATE:timestamp}\\] "%{WORD:method}' },
      { key: 'source_field', label: '源字段', type: 'string', defaultValue: 'raw_message', placeholder: '默认 raw_message' },
      { key: 'show_patterns', label: '查看常用模式', type: 'boolean', defaultValue: false },
    ],
  },
  {
    name: 'delimiter',
    label: '分隔符拆分',
    category: 'extraction',
    description: '按指定分隔符切分字段',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', defaultValue: 'raw_message' },
      { key: 'delimiter', label: '分隔符', type: 'string', required: true, defaultValue: '|', placeholder: '例: | 或 \\t 或 , ' },
      { key: 'fields', label: '字段名列表', type: 'string', required: true, placeholder: '逗号分隔，与切分后字段对应' },
      { key: 'trim', label: '去除空白', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'kv_split',
    label: 'KeyValue 分解',
    category: 'extraction',
    description: '按固定分隔符切分键值对',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true, placeholder: '例: query_string' },
      { key: 'pair_separator', label: '键值对分隔符', type: 'string', defaultValue: '&', placeholder: '例: &' },
      { key: 'kv_separator', label: '键值分隔符', type: 'string', defaultValue: '=', placeholder: '例: =' },
    ],
  },
  {
    name: 'kv_regex',
    label: 'KeyValue 正则匹配',
    category: 'extraction',
    description: '利用正则提取复杂 KV 字段',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'pattern', label: '正则模式', type: 'textarea', required: true, placeholder: '例: (?<key>[\\w]+)=(?<value>[^;]*)' },
      { key: 'include_keys', label: '保留 Keys', type: 'string', placeholder: '逗号分隔，可选' },
      { key: 'exclude_keys', label: '排除 Keys', type: 'string', placeholder: '逗号分隔，可选' },
    ],
  },
  {
    name: 'csv',
    label: 'CSV 解析',
    category: 'extraction',
    description: '按分隔符切分并映射字段名',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', defaultValue: 'raw_message' },
      { key: 'delimiter', label: '分隔符', type: 'string', defaultValue: ',', placeholder: '例: ,' },
      { key: 'fields', label: '字段名列表', type: 'string', required: true, placeholder: '逗号分隔，例: time,level,msg' },
    ],
  },
  {
    name: 'json',
    label: 'JSON 解析',
    category: 'extraction',
    description: '解析 JSON，支持 jsonpath',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', defaultValue: 'raw_message' },
      { key: 'jsonpath', label: 'JsonPath 映射', type: 'keyValue', placeholder: '字段名 -> JSONPath' },
    ],
  },
  {
    name: 'xml',
    label: 'XML 解析',
    category: 'extraction',
    description: '解析 XML，支持 xpath',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', defaultValue: 'raw_message' },
      { key: 'xpath', label: 'XPath 映射', type: 'keyValue', placeholder: '字段名 -> XPath' },
    ],
  },
  {
    name: 'syslog_pri',
    label: 'Syslog_pri 解析',
    category: 'extraction',
    description: '提取 PRI 中的 severity 和 facility',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', defaultValue: 'raw_message' },
    ],
  },
  {
    name: 'struct',
    label: '结构体解析',
    category: 'extraction',
    description: '按字段名:长度:类型解析定长数据',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', defaultValue: 'raw_message' },
      { key: 'format', label: '格式定义', type: 'string', required: true, placeholder: '例: header:4:s,length:2:i,body::s' },
    ],
  },
  {
    name: 'expand',
    label: 'Expand 多行拆分',
    category: 'extraction',
    description: '将 JSON 数组拆分为多条日志',
    params: [
      { key: 'source_field', label: '数组字段', type: 'string', required: true },
    ],
  },
  {
    name: 'multiline',
    label: '多行合并',
    category: 'extraction',
    description: '将多行日志合并为单条',
    params: [
      { key: 'pattern', label: '行首匹配模式', type: 'string', required: true, placeholder: '例: ^\\d{4}-\\d{2}-\\d{2}' },
      { key: 'negate', label: '反向匹配', type: 'boolean', defaultValue: false },
      { key: 'what', label: '合并方向', type: 'select', defaultValue: 'previous', options: [{ label: '合并到前一条', value: 'previous' }, { label: '合并到下一条', value: 'next' }] },
    ],
  },
  {
    name: 'cef',
    label: 'CEF 解析',
    category: 'extraction',
    description: '解析 Common Event Format 格式',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', defaultValue: 'raw_message' },
    ],
  },
  {
    name: 'leef',
    label: 'LEEF 解析',
    category: 'extraction',
    description: '解析 Log Event Extended Format',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', defaultValue: 'raw_message' },
    ],
  },
  {
    name: 'jwt_decode',
    label: 'JWT 解码',
    category: 'extraction',
    description: '解码 JWT Token',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
    ],
  },
  {
    name: 'parse_query_string',
    label: 'QueryString 解析',
    category: 'extraction',
    description: '解析 URL 查询参数',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_prefix', label: '字段前缀', type: 'string', defaultValue: 'qs_' },
    ],
  },
  {
    name: 'parse_cookie',
    label: 'Cookie 解析',
    category: 'extraction',
    description: '解析 Cookie 字符串',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_prefix', label: '字段前缀', type: 'string', defaultValue: 'cookie_' },
    ],
  },

  // 2. 类型转换与格式化
  {
    name: 'to_number',
    label: '数值型字段转换',
    category: 'conversion',
    description: '字符串转 int 或 float',
    params: [
      { key: 'fields', label: '字段列表', type: 'string', required: true, placeholder: '逗号分隔，例: status_code,bytes_sent' },
      { key: 'type', label: '目标类型', type: 'select', defaultValue: 'int', options: [{ label: 'int', value: 'int' }, { label: 'float', value: 'float' }] },
      { key: 'base', label: '进制', type: 'number', defaultValue: 10 },
    ],
  },
  {
    name: 'url_decode',
    label: 'URL 解码',
    category: 'conversion',
    description: '对 URL 编码字段解码',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', placeholder: '可选，默认覆盖源字段' },
    ],
  },
  {
    name: 'timestamp',
    label: '时间戳识别',
    category: 'conversion',
    description: '识别并转换时间戳',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'format', label: '时间格式', type: 'string', required: true, placeholder: '例: yyyy-MM-dd HH:mm:ss 或 ISO8601' },
      { key: 'timezone', label: '时区', type: 'string', placeholder: '例: Asia/Shanghai' },
    ],
  },
  {
    name: 'ip_convert',
    label: 'IP 格式转换',
    category: 'conversion',
    description: '长整型与 IPv4 互转或标记类型',
    params: [
      { key: 'fields', label: '字段列表', type: 'string', required: true, placeholder: '逗号分隔' },
      { key: 'action', label: '操作', type: 'select', defaultValue: 'mark_type', options: [{ label: '标记类型', value: 'mark_type' }, { label: '转长整型', value: 'to_long' }, { label: '转字符串', value: 'to_string' }] },
    ],
  },
  {
    name: 'hex',
    label: 'Hex 转换',
    category: 'conversion',
    description: '十六进制数据转原始报文',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', required: true },
    ],
  },
  {
    name: 'format',
    label: '格式化处理',
    category: 'conversion',
    description: '按模板重组字段生成新字段',
    params: [
      { key: 'target_field', label: '目标字段', type: 'string', required: true },
      { key: 'template', label: '模板', type: 'textarea', required: true, placeholder: '例: [$LOG_DATE] {method} {url} -> {status_code}' },
    ],
  },
  {
    name: 'trim',
    label: '去除空白',
    category: 'conversion',
    description: '去除字段首尾空白字符',
    params: [
      { key: 'fields', label: '字段列表', type: 'string', required: true, placeholder: '逗号分隔，留空则处理所有字段' },
      { key: 'chars', label: '指定字符', type: 'string', placeholder: '默认去除空格和制表符' },
    ],
  },
  {
    name: 'lowercase',
    label: '转小写',
    category: 'conversion',
    description: '将字段值转换为小写',
    params: [
      { key: 'fields', label: '字段列表', type: 'string', required: true, placeholder: '逗号分隔' },
    ],
  },
  {
    name: 'uppercase',
    label: '转大写',
    category: 'conversion',
    description: '将字段值转换为大写',
    params: [
      { key: 'fields', label: '字段列表', type: 'string', required: true, placeholder: '逗号分隔' },
    ],
  },
  {
    name: 'substring',
    label: '子字符串',
    category: 'conversion',
    description: '提取字段的子字符串',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', required: true },
      { key: 'start', label: '起始位置', type: 'number', defaultValue: 0 },
      { key: 'length', label: '长度', type: 'number', placeholder: '留空则取到末尾' },
    ],
  },
  {
    name: 'split',
    label: '字符串分割',
    category: 'conversion',
    description: '将字符串分割为数组',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'separator', label: '分隔符', type: 'string', required: true, defaultValue: ',', placeholder: '例: , 或 |' },
      { key: 'target_field', label: '目标字段', type: 'string', placeholder: '默认覆盖源字段' },
      { key: 'limit', label: '最大分割数', type: 'number', placeholder: '可选' },
    ],
  },
  {
    name: 'round',
    label: '数值取整',
    category: 'conversion',
    description: '对数值字段进行取整',
    params: [
      { key: 'fields', label: '字段列表', type: 'string', required: true, placeholder: '逗号分隔' },
      { key: 'decimals', label: '小数位数', type: 'number', defaultValue: 0 },
    ],
  },
  {
    name: 'hash',
    label: '哈希计算',
    category: 'conversion',
    description: '计算字段的哈希值',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', required: true },
      { key: 'algorithm', label: '算法', type: 'select', defaultValue: 'sha256', options: [{ label: 'SHA256', value: 'sha256' }, { label: 'SHA1', value: 'sha1' }, { label: 'MD5', value: 'md5' }] },
    ],
  },
  {
    name: 'bytes_convert',
    label: '字节转换',
    category: 'conversion',
    description: '字节单位转换 (B/KB/MB/GB)',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', placeholder: '默认覆盖源字段' },
      { key: 'to_unit', label: '目标单位', type: 'select', defaultValue: 'MB', options: [{ label: 'B', value: 'B' }, { label: 'KB', value: 'KB' }, { label: 'MB', value: 'MB' }, { label: 'GB', value: 'GB' }, { label: 'TB', value: 'TB' }] },
      { key: 'precision', label: '精度', type: 'number', defaultValue: 2 },
    ],
  },
  {
    name: 'calc',
    label: '数值计算',
    category: 'conversion',
    description: '字段间的数学运算',
    params: [
      { key: 'expression', label: '表达式', type: 'string', required: true, placeholder: '例: field1 + field2 * 2' },
      { key: 'target_field', label: '目标字段', type: 'string', required: true },
    ],
  },
  {
    name: 'base64',
    label: 'Base64 编解码',
    category: 'conversion',
    description: 'Base64 编码或解码',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', required: true },
      { key: 'operation', label: '操作', type: 'select', defaultValue: 'decode', options: [{ label: '解码', value: 'decode' }, { label: '编码', value: 'encode' }] },
    ],
  },
  {
    name: 'join',
    label: '数组连接',
    category: 'conversion',
    description: '将数组字段连接为字符串',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', placeholder: '默认覆盖源字段' },
      { key: 'separator', label: '连接符', type: 'string', defaultValue: ',', placeholder: '例: , 或 - ' },
    ],
  },
  {
    name: 'flatten',
    label: '对象扁平化',
    category: 'conversion',
    description: '嵌套对象扁平化',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_prefix', label: '字段前缀', type: 'string', defaultValue: '' },
      { key: 'separator', label: '分隔符', type: 'string', defaultValue: '_' },
    ],
  },
  {
    name: 'gzip_decompress',
    label: 'Gzip 解压',
    category: 'conversion',
    description: 'Gzip 解压',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', required: true },
    ],
  },
  {
    name: 'range',
    label: '范围标记',
    category: 'conversion',
    description: '根据数值范围打标签',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'ranges', label: '范围定义', type: 'string', required: true, placeholder: '例: 0-100:low,101-500:medium,501+:high' },
      { key: 'target_field', label: '目标字段', type: 'string', defaultValue: 'range_label' },
    ],
  },
  {
    name: 'translate',
    label: '文本翻译',
    category: 'conversion',
    description: '翻译文本',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', required: true },
      { key: 'target_language', label: '目标语言', type: 'select', defaultValue: 'en', options: [{ label: '英语', value: 'en' }, { label: '中文', value: 'zh' }, { label: '日语', value: 'ja' }, { label: '法语', value: 'fr' }] },
    ],
  },
  {
    name: 'summarize',
    label: '文本摘要',
    category: 'conversion',
    description: '生成文本摘要',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '摘要字段', type: 'string', defaultValue: 'summary' },
      { key: 'max_length', label: '最大长度', type: 'number', defaultValue: 100 },
    ],
  },

  // 3. 数据丰富与内容处理
  {
    name: 'ua_parse',
    label: 'User Agent 解析',
    category: 'enrichment',
    description: '提取 OS、浏览器、设备信息',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
    ],
  },
  {
    name: 'url_parse',
    label: 'URL 解析',
    category: 'enrichment',
    description: '解析 URL 为协议、域名、路径、参数等',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
    ],
  },
  {
    name: 'dict_expand',
    label: '字典扩展',
    category: 'enrichment',
    description: '用 CSV 字典将代码映射为可读内容',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'dict_name', label: '字典名称', type: 'string', required: true },
      { key: 'key_field', label: '字典键字段', type: 'string', required: true },
      { key: 'value_field', label: '字典值字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', required: true },
    ],
  },
  {
    name: 'replace',
    label: '内容替换',
    category: 'enrichment',
    description: '用正则修改字段内容',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'pattern', label: '正则模式', type: 'textarea', required: true },
      { key: 'replacement', label: '替换为', type: 'string', defaultValue: '' },
    ],
  },
  {
    name: 'phone_parse',
    label: '号码解析',
    category: 'enrichment',
    description: '解析手机号/固话归属地和运营商',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
    ],
  },
  {
    name: 'geo',
    label: 'Geo 解析',
    category: 'enrichment',
    description: '基于 IP 解析地理位置',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_prefix', label: '目标前缀', type: 'string', defaultValue: 'geo_', placeholder: '例: geo_' },
    ],
  },
  {
    name: 'mask',
    label: '脱敏配置',
    category: 'enrichment',
    description: '隐藏敏感信息',
    params: [
      { key: 'field', label: '字段名', type: 'string', required: true },
      { key: 'pattern', label: '正则模式', type: 'textarea', required: true, placeholder: '例: (\\d{3})\\d{4}(\\d{4})' },
      { key: 'replacement', label: '替换为', type: 'string', defaultValue: '$1****$2' },
      { key: 'roles', label: '可见角色', type: 'string', placeholder: '逗号分隔，留空则全部脱敏' },
    ],
  },
  {
    name: 'cidr_lookup',
    label: 'CIDR 匹配',
    category: 'enrichment',
    description: '检查 IP 是否属于指定 CIDR 网段',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'cidr', label: 'CIDR 网段', type: 'string', required: true, placeholder: '例: 192.168.0.0/16,10.0.0.0/8' },
      { key: 'target_field', label: '结果字段', type: 'string', defaultValue: 'in_cidr' },
    ],
  },
  {
    name: 'anonymize_ip',
    label: 'IP 匿名化',
    category: 'enrichment',
    description: '匿名化 IP 地址（GDPR 合规）',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', placeholder: '默认覆盖源字段' },
      { key: 'ipv4_mask', label: 'IPv4 掩码', type: 'number', defaultValue: 24 },
      { key: 'ipv6_mask', label: 'IPv6 掩码', type: 'number', defaultValue: 64 },
    ],
  },

  // 4. 字段操作与高级处理
  {
    name: 'remove',
    label: '删除字段',
    category: 'advanced',
    description: '清理无用中间字段',
    params: [
      { key: 'fields', label: '字段列表', type: 'string', required: true, placeholder: '逗号分隔' },
    ],
  },
  {
    name: 'pick',
    label: '字段选择',
    category: 'advanced',
    description: '只保留指定字段',
    params: [
      { key: 'fields', label: '字段列表', type: 'string', required: true, placeholder: '逗号分隔，其他字段将被删除' },
    ],
  },
  {
    name: 'omit',
    label: '字段排除',
    category: 'advanced',
    description: '排除指定字段',
    params: [
      { key: 'fields', label: '字段列表', type: 'string', required: true, placeholder: '逗号分隔，其他字段保留' },
    ],
  },
  {
    name: 'rename',
    label: '字段重命名',
    category: 'advanced',
    description: '修改字段名',
    params: [
      { key: 'mappings', label: '映射关系', type: 'keyValue', placeholder: '旧字段名 -> 新字段名' },
    ],
  },
  {
    name: 'copy',
    label: '复制字段',
    category: 'advanced',
    description: '复制字段值到新字段',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', required: true },
    ],
  },
  {
    name: 'filter',
    label: '条件过滤',
    category: 'advanced',
    description: '根据条件保留或丢弃日志',
    params: [
      { key: 'condition', label: '条件表达式', type: 'string', required: true, placeholder: '例: status_code >= 400 || method == "POST"' },
      { key: 'action', label: '操作', type: 'select', defaultValue: 'keep', options: [{ label: '保留符合条件的日志', value: 'keep' }, { label: '丢弃符合条件的日志', value: 'drop' }] },
    ],
  },
  {
    name: 'dedup',
    label: '去重处理',
    category: 'advanced',
    description: '基于字段值进行去重',
    params: [
      { key: 'fields', label: '去重字段', type: 'string', required: true, placeholder: '逗号分隔' },
      { key: 'window', label: '时间窗口(秒)', type: 'number', defaultValue: 300 },
    ],
  },
  {
    name: 'fingerprint',
    label: '指纹生成',
    category: 'advanced',
    description: '基于字段内容生成唯一指纹',
    params: [
      { key: 'fields', label: '参与指纹计算的字段', type: 'string', required: true, placeholder: '逗号分隔' },
      { key: 'target_field', label: '目标字段', type: 'string', defaultValue: 'fingerprint' },
      { key: 'method', label: '哈希方法', type: 'select', defaultValue: 'sha256', options: [{ label: 'SHA256', value: 'sha256' }, { label: 'SHA1', value: 'sha1' }, { label: 'MD5', value: 'md5' }] },
    ],
  },
  {
    name: 'aggregate',
    label: '聚合统计',
    category: 'advanced',
    description: '基于窗口的聚合计算',
    params: [
      { key: 'group_by', label: '分组字段', type: 'string', required: true, placeholder: '逗号分隔' },
      { key: 'window', label: '时间窗口(秒)', type: 'number', defaultValue: 60 },
      { key: 'metrics', label: '聚合指标', type: 'string', required: true, placeholder: '格式: 字段:函数，例: bytes:sum,status_code:count' },
    ],
  },
  {
    name: 'redirect',
    label: '重定向解析',
    category: 'advanced',
    description: '按条件分发到不同规则链',
    params: [
      { key: 'condition', label: '条件表达式', type: 'string', required: true, placeholder: '例: %{source} == "firewall"' },
      { key: 'target_rule', label: '目标规则链', type: 'string', required: true },
    ],
  },
  {
    name: 'script',
    label: 'Script 解析',
    category: 'advanced',
    description: '高级流式数据处理脚本',
    params: [
      { key: 'script', label: '脚本内容', type: 'textarea', required: true, placeholder: '例: if (bytes_sent > 1024) { mb = bytes_sent / 1024 / 1024; }' },
    ],
  },
  {
    name: 'udf',
    label: 'UDF 规则',
    category: 'advanced',
    description: 'Java jar 自定义解析',
    params: [
      { key: 'jar', label: 'JAR 包名', type: 'string', required: true },
      { key: 'class', label: '类全名', type: 'string', required: true },
    ],
  },
  {
    name: 'default',
    label: '默认值',
    category: 'advanced',
    description: '为字段设置默认值',
    params: [
      { key: 'field', label: '字段名', type: 'string', required: true },
      { key: 'value', label: '默认值', type: 'string', required: true },
    ],
  },
  {
    name: 'unique',
    label: '数组去重',
    category: 'advanced',
    description: '对数组字段去重',
    params: [
      { key: 'source_field', label: '源字段', type: 'string', required: true },
      { key: 'target_field', label: '目标字段', type: 'string', placeholder: '默认覆盖源字段' },
    ],
  },
  {
    name: 'set',
    label: '设置字段',
    category: 'advanced',
    description: '设置字段为固定值',
    params: [
      { key: 'field', label: '字段名', type: 'string', required: true },
      { key: 'value', label: '值', type: 'string', required: true },
    ],
  },
  {
    name: 'tag',
    label: '添加标签',
    category: 'advanced',
    description: '为事件添加标签',
    params: [
      { key: 'tags', label: '标签', type: 'string', required: true, placeholder: '逗号分隔' },
    ],
  },
  {
    name: 'sample',
    label: '采样',
    category: 'advanced',
    description: '按比例采样事件',
    params: [
      { key: 'rate', label: '采样率', type: 'number', defaultValue: 10, placeholder: '1-100' },
    ],
  },
]

export function getOperatorMeta(name: string): OperatorMeta | undefined {
  return operators.find((op) => op.name === name)
}
