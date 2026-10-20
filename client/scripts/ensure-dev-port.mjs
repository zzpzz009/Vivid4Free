import { execSync } from 'node:child_process'

const port = 3002

function run(command) {
  return execSync(command, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' }).trim()
}

function findWindowsPidsByPort(targetPort) {
  try {
    const output = run(`netstat -ano -p tcp | findstr :${targetPort}`)
    const lines = output.split(/\r?\n/).filter(Boolean)
    const pids = new Set()
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) continue
      const state = parts[3]
      const pid = Number(parts[4])
      if (state === 'LISTENING' && Number.isInteger(pid) && pid > 0) {
        pids.add(pid)
      }
    }
    return [...pids]
  } catch {
    return []
  }
}

function killWindowsPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (process.platform === 'win32') {
  const pids = findWindowsPidsByPort(port)
  for (const pid of pids) {
    killWindowsPid(pid)
  }
}
