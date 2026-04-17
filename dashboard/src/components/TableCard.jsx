import { PanelHead } from "./PanelHead.jsx"

export function TableCard({ title, columns, rows, getKey, className = "", emptyMessage = "No rows yet.", icon, iconAccent = "default" }) {
  const isEmpty = !rows?.length

  return (
    <section className={`card table-card ${className}`.trim()}>
      <PanelHead title={title} icon={icon} accent={iconAccent} />
      {isEmpty ? (
        <p className="table-empty">{emptyMessage}</p>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={getKey(row)}>
                  {Object.values(row).map((value, index) => (
                    <td key={`${getKey(row)}-${index}`}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
