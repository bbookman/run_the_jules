import React from 'react';
import DateNormalizerFE from '../../utils/DateNormalizerFE';
import './Module.css'; // Shared module styles

const LimitlessModule = ({ data }) => {
  if (!data || !data.entries || data.entries.length === 0) {
    return (
      <div className="data-module limitless-module-styles">
        <h3>Limitless</h3>
        <p>No Limitless entries for this day.</p>
      </div>
    );
  }

  return (
    <div className="data-module limitless-module-styles vertical-rectangle-module">
      <h3>Limitless ({data.count || data.entries.length})</h3>
      <ul>
        {data.entries.map(entry => (
          <li key={entry.id || entry.limitless_id}>
            <strong>{entry.title || 'Untitled Entry'}</strong>
            {entry.is_starred && <span title="Starred" style={{color: 'gold', marginLeft: '5px'}}>★</span>}
            <span className="meta-info">
              {DateNormalizerFE.formatDateReadable(entry.start_time)} - {DateNormalizerFE.formatDateReadable(entry.end_time)}
            </span>
            {entry.markdown_content && (
              <div className="content-preview">
                {/* Displaying first N characters of markdown, or a more sophisticated preview */}
                {entry.markdown_content.substring(0, 150)}{entry.markdown_content.length > 150 ? '...' : ''}
              </div>
            )}
            {/* TODO: Render content_nodes if available and needed for preview */}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LimitlessModule;
