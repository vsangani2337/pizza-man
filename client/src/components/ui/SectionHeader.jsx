/** Consistent section heading used across Home, Menu and account pages. */
const SectionHeader = ({ eyebrow, title, subtitle, action, align = 'start', id }) => (
  <header className={`section-header ${align === 'center' ? 'is-center' : ''}`}>
    <div className="section-header-text">
      {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
      <h2 className="section-title" id={id}>
        {title}
      </h2>
      {subtitle && <p className="section-subtitle">{subtitle}</p>}
    </div>
    {action && <div className="section-header-action">{action}</div>}
  </header>
);

export default SectionHeader;
