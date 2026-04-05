export interface Preset {
  name: string
  rawLog: string
  rules: Record<string, unknown>[]
}

export const presets: Preset[] = [
  {
    name: 'Nginx 访问日志',
    rawLog: '192.168.1.1 - - [10/Oct/2023:13:55:36 +0800] "GET /api/users?page=1 HTTP/1.1" 200 512 "https://example.com" "Mozilla/5.0"',
    rules: [
      {
        operator: 'regex',
        source_field: 'raw_message',
        pattern: '^(?<client_ip>\\S+)\\s+-\\s+-\\s+\\[(?<log_time>[^\\]]+)\\]\\s+"(?<method>\\w+)\\s+(?<request>\\S+)\\s+HTTP\\/(?<http_version>[\\d.]+)"\\s+(?<status_code>\\d+)\\s+(?<bytes_sent>\\d+)\\s+"(?<referrer>[^"]*)"\\s+"(?<user_agent>[^"]*)"',
      },
      { operator: 'timestamp', source_field: 'log_time', format: 'dd/MMM/yyyy:HH:mm:ss Z' },
      { operator: 'to_number', fields: 'status_code,bytes_sent', type: 'int' },
      { operator: 'ua_parse', source_field: 'user_agent' },
      { operator: 'geo', source_field: 'client_ip', target_prefix: 'geo_' },
      { operator: 'trim', fields: 'method,request' },
      { operator: 'remove', fields: 'log_time' },
    ],
  },
  {
    name: 'Apache 访问日志',
    rawLog: '127.0.0.1 - frank [10/Oct/2023:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326',
    rules: [
      {
        operator: 'regex',
        pattern: '(?<client_ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\\s+(?<ident>\\S+)\\s+(?<auth>\\S+)\\s+\\[(?<log_time>[^\\]]+)\\]\\s+"(?<method>\\w+)\\s+(?<request>[^\\s]+)\\s+HTTP/(?<httpversion>\\d\\.\\d)"\\s+(?<status_code>\\d+)\\s+(?<bytes_sent>\\d+)',
      },
      { operator: 'timestamp', source_field: 'log_time', format: 'dd/MMM/yyyy:HH:mm:ss Z' },
      { operator: 'to_number', fields: 'status_code,bytes_sent', type: 'int' },
      { operator: 'geo', source_field: 'client_ip', target_prefix: 'geo_' },
      { operator: 'lowercase', fields: 'method' },
      { operator: 'remove', fields: 'log_time,ident,auth' },
    ],
  },
  {
    name: 'Tomcat 访问日志',
    rawLog: '192.168.1.100 - - [10/Oct/2023:13:55:36 +0800] "POST /manager/html/upload HTTP/1.1" 200 1234',
    rules: [
      {
        operator: 'grok',
        pattern: '%{IP:client_ip} %{DATA:ident} %{DATA:auth} \\[%{HTTPDATE:log_time}\\] "%{WORD:method} %{URIPATHPARAM:request} HTTP/%{NUMBER:httpversion}" %{NUMBER:status_code} (?:%{NUMBER:bytes_sent}|-)',
      },
      { operator: 'timestamp', source_field: 'log_time', format: 'dd/MMM/yyyy:HH:mm:ss Z' },
      { operator: 'to_number', fields: 'status_code,bytes_sent', type: 'int' },
      { operator: 'filter', condition: 'status_code >= 400', action: 'keep' },
      { operator: 'geo', source_field: 'client_ip', target_prefix: 'geo_' },
      { operator: 'remove', fields: 'log_time,ident,auth' },
    ],
  },
  {
    name: 'Spring Boot 日志',
    rawLog: JSON.stringify({
      '@timestamp': '2023-10-10T13:55:36.123+08:00',
      'level': 'ERROR',
      'logger_name': 'com.example.service.UserService',
      'thread_name': 'http-nio-8080-exec-1',
      'message': 'Failed to connect to database',
      'stack_trace': 'java.sql.SQLException: Connection refused',
      'app_name': 'user-service',
      'traceId': 'abc123def456',
      'spanId': 'span789'
    }, null, 2),
    rules: [
      {
        operator: 'json',
        source_field: 'raw_message',
        jsonpath: {
          log_time: '$.@timestamp',
          level: '$.level',
          logger: '$.logger_name',
          thread: '$.thread_name',
          message: '$.message',
          error: '$.stack_trace',
          service: '$.app_name',
          trace_id: '$.traceId',
          span_id: '$.spanId',
        },
      },
      { operator: 'timestamp', source_field: 'log_time', format: 'ISO8601' },
      { operator: 'lowercase', fields: 'level' },
      { operator: 'trim', fields: 'message,logger' },
      { operator: 'format', target_field: 'summary', template: '[{level}] {service}: {message}' },
      { operator: 'remove', fields: 'log_time' },
    ],
  },
  {
    name: 'JSON 应用日志',
    rawLog: JSON.stringify({
      timestamp: '2023-10-10T13:55:36+08:00',
      level: 'ERROR',
      service: 'payment',
      message: 'Timeout',
      context: { user_id: 'U12345', order_id: 'O98765' },
    }, null, 2),
    rules: [
      {
        operator: 'json',
        source_field: 'raw_message',
        jsonpath: {
          log_time: '$.timestamp',
          level: '$.level',
          service: '$.service',
          msg: '$.message',
          user_id: '$.context.user_id',
          order_id: '$.context.order_id',
        },
      },
      { operator: 'timestamp', source_field: 'log_time', format: 'ISO8601' },
      { operator: 'format', target_field: 'summary', template: '[{level}] {service}: {msg}' },
      { operator: 'remove', fields: 'log_time,timestamp' },
    ],
  },
  {
    name: 'Syslog 日志',
    rawLog: '<134>1 2023-10-10T13:55:36.000+08:00 web01 nginx - - [origin software="nginx" swVersion="1.18"] Worker process started',
    rules: [
      { operator: 'syslog_pri', source_field: 'raw_message' },
      { operator: 'regex', pattern: '<\\d+>\\d+ (?<log_time>[^\\s]+) (?<host>\\S+) (?<app>\\S+).* - - (?<msg>.*)' },
      { operator: 'timestamp', source_field: 'log_time', format: 'ISO8601' },
      { operator: 'remove', fields: 'log_time' },
    ],
  },
  {
    name: 'URL Query String',
    rawLog: '2023-10-10 13:55:36 | user=admin&action=login&ip=192.168.1.1&session=abc123',
    rules: [
      { operator: 'regex', pattern: '(?<log_time>[^|]+)\\s*\\|\\s*(?<qs>.+)' },
      { operator: 'kv_split', source_field: 'qs', pair_separator: '&', kv_separator: '=' },
      { operator: 'timestamp', source_field: 'log_time', format: 'yyyy-MM-dd HH:mm:ss' },
      { operator: 'mask', field: 'session', pattern: '.+', replacement: '***' },
      { operator: 'remove', fields: 'log_time,qs' },
    ],
  },
  {
    name: 'CSV 防火墙日志',
    rawLog: '2023-10-10 13:55:36,ALLOW,TCP,192.168.1.1,10.0.0.1,443,1024',
    rules: [
      { operator: 'csv', source_field: 'raw_message', delimiter: ',', fields: 'log_time,action,proto,src_ip,dst_ip,dst_port,bytes' },
      { operator: 'timestamp', source_field: 'log_time', format: 'yyyy-MM-dd HH:mm:ss' },
      { operator: 'to_number', fields: 'dst_port,bytes', type: 'int' },
      { operator: 'geo', source_field: 'src_ip', target_prefix: 'src_geo_' },
      { operator: 'remove', fields: 'log_time' },
    ],
  },
  {
    name: 'JSON 数组拆分',
    rawLog: JSON.stringify({
      time: '2023-10-10T13:55:36+08:00',
      events: [
        { type: 'login', user: 'a' },
        { type: 'logout', user: 'b' },
      ],
    }, null, 2),
    rules: [
      { operator: 'json', source_field: 'raw_message' },
      { operator: 'rename', mappings: { time: 'base_time' } },
      { operator: 'expand', source_field: 'events' },
      { operator: 'format', target_field: 'event_desc', template: '{user} performed {type} at {base_time}' },
      { operator: 'remove', fields: 'base_time,events' },
    ],
  },
  {
    name: 'MySQL 慢查询日志 (RDS/标准)',
    description: 'MySQL Slow Query Log - 支持 RDS for MySQL 多行格式',
    rawLog: `# Time: 2026-01-13T10:35:21.229514+08:00
# User@Host: linlin[linlin] @  [28.13.5.31]  Id: 154043825
# Query_time: 1.193432  Lock_time: 0.000186 Rows_sent: 1  Rows_examined: 359824 Thread_id: 154043825 Schema: nbms
# QC_Hit: No  Full_scan: Yes  Full_join: Yes  Tmp_table: No  Filesort: No
SET timestamp=1768271720;
select count(1) from my_table where id = '123';`,
    rules: [
      // 1. 多行合并：以 # Time: 开头的行为新日志，其他行合并到前一行
      { operator: 'multiline', pattern: '^# Time:', negate: false, what: 'previous' },
      // 2. 提取时间戳
      { operator: 'regex', pattern: '# Time: (?<timestamp>\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d+(?:\\+\\d{2}:\\d{2})?)' },
      // 3. 提取用户信息
      { operator: 'regex', pattern: 'User@Host:\\s+(?<user>\\w+)\\[[^\\]]*\\]\\s+@\\s*\\[?(?<client_host>[^\\]]*)\\]?\\s+Id:\\s+(?<thread_id>\\d+)' },
      // 4. 提取客户端 IP
      { operator: 'regex', pattern: '@\\s*\\[?(?<client_ip>\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\\]?' },
      // 5. 提取查询性能指标
      { operator: 'regex', pattern: 'Query_time:\\s+(?<query_time>[\\d.]+)' },
      { operator: 'regex', pattern: 'Lock_time:\\s+(?<lock_time>[\\d.]+)' },
      { operator: 'regex', pattern: 'Rows_sent:\\s+(?<rows_sent>\\d+)' },
      { operator: 'regex', pattern: 'Rows_examined:\\s+(?<rows_examined>\\d+)' },
      { operator: 'regex', pattern: 'Schema:\\s+(?<schema>\\w+)' },
      // 6. 提取扫描类型信息
      { operator: 'regex', pattern: 'Full_scan:\\s+(?<full_scan>\\w+)' },
      { operator: 'regex', pattern: 'Full_join:\\s+(?<full_join>\\w+)' },
      { operator: 'regex', pattern: 'Tmp_table:\\s+(?<tmp_table>\\w+)' },
      { operator: 'regex', pattern: 'Filesort:\\s+(?<filesort>\\w+)' },
      // 7. 提取 SQL 语句（多行模式）
      { operator: 'regex', pattern: 'SET timestamp=\\d+;\\s*(?<sql>[\\s\\S]+)$' },
      // 8. 数据类型转换
      { operator: 'timestamp', source_field: 'timestamp', format: 'ISO8601' },
      { operator: 'to_number', fields: 'query_time,lock_time,rows_sent,rows_examined,thread_id', type: 'float' },
      // 9. 计算严重程度
      { operator: 'eval', expression: "query_time >= 10 ? 'critical' : query_time >= 2 ? 'warning' : 'info'", target_field: 'severity' },
      // 10. 清理字段
      { operator: 'remove', fields: 'raw_message' },
    ],
  },
  {
    name: 'PostgreSQL 日志',
    rawLog: '2023-10-10 13:55:36.123 CST [42] user@mydb LOG:  duration: 2500.234 ms  statement: SELECT * FROM users WHERE active = true;',
    rules: [
      { operator: 'regex', pattern: '(?<log_time>\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d+)\\s+(?<timezone>\\w+)\\s+\\[(?<pid>\\d+)\\]\\s+(?<user>[^@]+)@(?<database>\\S+)\\s+(?<level>\\w+):\\s+duration:\\s+(?<duration>[\\d.]+)\\s+ms\\s+statement:\\s+(?<query>.+)', source_field: 'raw_message' },
      { operator: 'timestamp', source_field: 'log_time', format: 'yyyy-MM-dd HH:mm:ss.SSS' },
      { operator: 'to_number', fields: 'duration,pid', type: 'float' },
      { operator: 'lowercase', fields: 'level' },
      { operator: 'trim', fields: 'query,user,database' },
      { operator: 'remove', fields: 'log_time,timezone' },
    ],
  },
  {
    name: 'Docker 容器日志',
    rawLog: JSON.stringify({
      log: '2023-10-10 13:55:36 Application started successfully\\n',
      stream: 'stdout',
      attrs: {
        name: 'my-app',
        image: 'my-app:latest',
        container: 'abc123def456'
      },
      time: '2023-10-10T13:55:36.123456789Z'
    }, null, 2),
    rules: [
      { operator: 'json', source_field: 'raw_message', jsonpath: { message: '$.log', stream: '$.stream', container_name: '$.attrs.name', image: '$.attrs.image', container_id: '$.attrs.container', timestamp: '$.time' } },
      { operator: 'timestamp', source_field: 'timestamp', format: 'ISO8601' },
      { operator: 'trim', fields: 'message,container_name,image' },
      { operator: 'lowercase', fields: 'stream' },
      { operator: 'format', target_field: 'container_info', template: '{container_name} ({image})' },
      { operator: 'remove', fields: 'timestamp,image' },
    ],
  },
  {
    name: 'Kubernetes 日志',
    rawLog: JSON.stringify({
      level: 'error',
      ts: '2023-10-10T13:55:36.123Z',
      caller: 'controller.go:123',
      msg: 'Failed to sync deployment',
      error: 'deployment.apps "my-app" not found',
      controller: 'deployment',
      namespace: 'default',
      name: 'my-app',
      stacktrace: 'main.main\\n\\t/workspace/controller.go:123'
    }, null, 2),
    rules: [
      { operator: 'json', source_field: 'raw_message', jsonpath: { level: '$.level', timestamp: '$.ts', caller: '$.caller', message: '$.msg', error_msg: '$.error', controller: '$.controller', namespace: '$.namespace', resource_name: '$.name' } },
      { operator: 'timestamp', source_field: 'timestamp', format: 'ISO8601' },
      { operator: 'lowercase', fields: 'level' },
      { operator: 'trim', fields: 'message,error_msg,controller' },
      { operator: 'format', target_field: 'resource', template: '{controller}/{namespace}/{resource_name}' },
      { operator: 'filter', condition: 'level == "error" || level == "fatal"', action: 'keep' },
      { operator: 'remove', fields: 'timestamp,controller,namespace,resource_name' },
    ],
  },
  {
    name: 'Linux 认证日志',
    rawLog: 'Oct 10 13:55:36 myserver sshd[1234]: Accepted password for admin from 192.168.1.100 port 54321 ssh2',
    rules: [
      { operator: 'grok', pattern: '%{SYSLOGTIMESTAMP:log_time}\\s+%{DATA:host}\\s+%{DATA:process}\\[%{NUMBER:pid}\\]:\\s+(?<message>.+)', source_field: 'raw_message' },
      { operator: 'grok', pattern: 'Accepted\\s+(?<auth_method>\\w+)\\s+for\\s+(?<user>\\w+)\\s+from\\s+%{IP:src_ip}\\s+port\\s+%{NUMBER:port}', source_field: 'message' },
      { operator: 'geo', source_field: 'src_ip', target_prefix: 'geo_' },
      { operator: 'to_number', fields: 'pid,port', type: 'int' },
      { operator: 'trim', fields: 'user,host,process' },
      { operator: 'lowercase', fields: 'auth_method' },
      { operator: 'remove', fields: 'message,log_time' },
    ],
  },
  {
    name: 'Windows 事件日志',
    rawLog: JSON.stringify({
      EventID: 4624,
      Level: 'Information',
      Channel: 'Security',
      Computer: 'WIN-SERVER01',
      TimeCreated: '2023-10-10T13:55:36.1234567Z',
      EventData: {
        TargetUserName: 'administrator',
        TargetDomainName: 'CORP',
        LogonType: 2,
        IpAddress: '192.168.1.100',
        Status: '0x0'
      }
    }, null, 2),
    rules: [
      { operator: 'json', source_field: 'raw_message', jsonpath: { event_id: '$.EventID', level: '$.Level', channel: '$.Channel', computer: '$.Computer', timestamp: '$.TimeCreated', username: '$.EventData.TargetUserName', domain: '$.EventData.TargetDomainName', logon_type: '$.EventData.LogonType', ip_address: '$.EventData.IpAddress', status: '$.EventData.Status' } },
      { operator: 'timestamp', source_field: 'timestamp', format: 'ISO8601' },
      { operator: 'to_number', fields: 'event_id,logon_type', type: 'int' },
      { operator: 'lowercase', fields: 'level,channel,username,domain' },
      { operator: 'trim', fields: 'computer,username,domain' },
      { operator: 'geo', source_field: 'ip_address', target_prefix: 'src_' },
      { operator: 'format', target_field: 'user_fqdn', template: '{domain}\\{username}' },
      { operator: 'remove', fields: 'timestamp' },
    ],
  },
]
