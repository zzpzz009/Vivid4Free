const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const [command, argument] = process.argv.slice(2);
  const routes = { status: ['/client'], capabilities: ['/capabilities'], tasks: ['/tasks'],
    submit: ['/tasks', 'POST'], 'show-task': ['/client/show-task', 'POST'],
    screenshot: ['/client/screenshot'], shutdown: ['/client/shutdown', 'POST'] };
  if (!Object.hasOwn(routes, command)) throw new Error('支持 status、capabilities、tasks、submit 请求.json、show-task 任务ID、screenshot 结果.png、shutdown');
  const file = process.env.VIVID_AGENT_CONTROL_FILE || path.join(process.env.APPDATA || '', 'vivid-desktop', 'agent-control.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.pathname !== '/v1' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || typeof config.token !== 'string' || config.token.length < 32) throw new Error('无效的本机 Agent 配置');
  const [route, method = 'GET'] = routes[command];
  let input;
  if (command === 'submit') input = JSON.parse(fs.readFileSync(argument, 'utf8'));
  if (command === 'show-task') input = { taskId: argument };
  if (command === 'shutdown') input = {};
  if (command === 'screenshot' && (!argument || path.extname(argument).toLowerCase() !== '.png')) throw new Error('请指定本地 PNG 输出路径');
  const response = await fetch(`${config.endpoint}${route}`, { method,
    headers: { authorization: `Bearer ${config.token}`, ...(input ? { 'Content-Type': 'application/json' } : {}) },
    body: input ? JSON.stringify(input) : undefined, signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Agent ${response.status}: ${error.error || '请求失败'}`);
  }
  if (command === 'screenshot') {
    fs.writeFileSync(argument, Buffer.from(await response.arrayBuffer()));
    console.log(JSON.stringify({ saved: path.resolve(argument) }));
  } else console.log(JSON.stringify(await response.json(), null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
