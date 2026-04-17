export function logDecision(decision) {
  if (process.env.AUDIT_LOG_STDOUT !== "true") {
    return
  }

  console.log(
    JSON.stringify({
      type: "sentinel.audit",
      at: new Date().toISOString(),
      ...decision
    })
  )
}

