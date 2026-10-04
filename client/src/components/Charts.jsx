import { useId } from 'react';

/**
 * Dependency-free SVG charts with accessible fallbacks
 * (each chart exposes a visually-hidden data table for screen readers).
 */

const ChartTable = ({ label, rows }) => (
  <table className="sr-only-chart-table">
    <caption>{label}</caption>
    <thead>
      <tr>
        <th scope="col">Label</th>
        <th scope="col">Value</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row, index) => (
        <tr key={index}>
          <th scope="row">{row.label}</th>
          <td>{row.value}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const BarChart = ({ data, valueKey = 'value', labelKey = 'label', title, format = (v) => v, height = 180 }) => {
  const titleId = useId();
  const rows = data.map((item) => ({ label: item[labelKey], value: format(item[valueKey]) }));
  const max = Math.max(1, ...data.map((item) => Number(item[valueKey]) || 0));

  if (data.length === 0) {
    return <p className="chart-empty">No data for this period.</p>;
  }

  return (
    <figure className="chart" role="group" aria-labelledby={titleId}>
      <figcaption id={titleId} className="chart-title">{title}</figcaption>
      <div className="chart-bars" style={{ height }} aria-hidden="true">
        {data.map((item, index) => {
          const value = Number(item[valueKey]) || 0;
          const pct = Math.round((value / max) * 100);
          return (
            <div className="chart-bar-slot" key={`${item[labelKey]}-${index}`} title={`${item[labelKey]}: ${format(value)}`}>
              <div className="chart-bar" style={{ height: `${Math.max(pct, value > 0 ? 4 : 0)}%` }} />
              <span className="chart-bar-label">{item[labelKey]}</span>
            </div>
          );
        })}
      </div>
      <ChartTable label={`${title} data`} rows={rows} />
    </figure>
  );
};

export const LineChart = ({ data, xKey = 'date', yKey = 'revenue', title, format = (v) => v, height = 180 }) => {
  const titleId = useId();
  const rows = data.map((item) => ({ label: item[xKey], value: format(item[yKey]) }));

  if (data.length < 2) {
    return <p className="chart-empty">Not enough data points yet.</p>;
  }

  const width = 600;
  const pad = 10;
  const max = Math.max(1, ...data.map((item) => Number(item[yKey]) || 0));
  const stepX = (width - pad * 2) / (data.length - 1);
  const points = data.map((item, index) => {
    const x = pad + index * stepX;
    const y = height - pad - ((Number(item[yKey]) || 0) / max) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <figure className="chart" role="group" aria-labelledby={titleId}>
      <figcaption id={titleId} className="chart-title">{title}</figcaption>
      <svg
        className="chart-line"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-hidden="true"
      >
        <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((point, index) => {
          const [cx, cy] = point.split(',');
          return <circle key={index} cx={cx} cy={cy} r="3" fill="currentColor" />;
        })}
      </svg>
      <div className="chart-axis" aria-hidden="true">
        <span>{data[0][xKey]}</span>
        <span>{data[data.length - 1][xKey]}</span>
      </div>
      <ChartTable label={`${title} data`} rows={rows} />
    </figure>
  );
};

export const TopList = ({ title, items, valueKey = 'qty', nameKey = 'name', format = (v) => v }) => {
  const titleId = useId();
  if (!items || items.length === 0) {
    return <p className="chart-empty">{title}: no data yet.</p>;
  }
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey]) || 0));

  return (
    <figure className="top-list" role="group" aria-labelledby={titleId}>
      <figcaption id={titleId} className="chart-title">{title}</figcaption>
      <ul className="top-list-items">
        {items.map((item, index) => (
          <li key={`${item[nameKey]}-${index}`}>
            <span className="top-list-name">{index + 1}. {item[nameKey]}</span>
            <span className="top-list-bar-wrap" aria-hidden="true">
              <span className="top-list-bar" style={{ width: `${Math.max(4, ((Number(item[valueKey]) || 0) / max) * 100)}%` }} />
            </span>
            <span className="top-list-value">{format(item[valueKey])}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
};

export default { BarChart, LineChart, TopList };
