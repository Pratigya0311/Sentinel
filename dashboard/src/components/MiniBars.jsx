export function MiniBars({ history }) {
  if (!history?.length) {
    return <p className="bars-empty">No merged windows yet. Traffic history will fill in as the aggregator receives gateway ticks.</p>
  }

  const peak = Math.max(1, ...history.map((item) => item.totalRequests))

  return (
    <div className="bars">
      {history.map((item) => (
        <div key={`${item.instanceId}-${item.bucket}`} className="bar-group">
          <span
            className="bar allowed"
            style={{ height: `${Math.max(8, (item.allowedCount / peak) * 132)}px` }}
            title={`${item.allowedCount} allowed`}
          />
          <span
            className="bar blocked"
            style={{ height: `${Math.max(4, (item.blockedCount / peak) * 132)}px` }}
            title={`${item.blockedCount} blocked`}
          />
        </div>
      ))}
    </div>
  )
}
