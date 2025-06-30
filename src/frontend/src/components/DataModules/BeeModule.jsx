import React from 'react';
import DateNormalizerFE from '../../utils/DateNormalizerFE';
import './Module.css'; // Shared module styles

const BeeModule = ({ data }) => {
  if (!data || !data.conversations || data.conversations.length === 0) {
    // PRD implies Bee module might also show facts or todos. For MVP, focusing on conversations.
    return (
      <div className="data-module bee-module-styles">
        <h3>Bee.computer</h3>
        <p>No Bee.computer conversations for this day.</p>
        {/* <p>No Bee.computer activity for this day (conversations, facts, todos).</p> */}
      </div>
    );
  }

  return (
    <div className="data-module bee-module-styles vertical-rectangle-module">
      <h3>Bee.computer Conversations ({data.count || data.conversations.length})</h3>
      <ul>
        {data.conversations.map(convo => (
          <li key={convo.id || convo.bee_id}>
            <strong>{convo.short_summary || convo.summary || 'Conversation Summary'}</strong>
            <span className="meta-info">
              Device: {convo.device_type || 'N/A'} | Started: {DateNormalizerFE.formatDateReadable(convo.start_time)}
            </span>
            {convo.summary && convo.summary !== (convo.short_summary || '') && (
                 <p className="content-preview"><em>Summary:</em> {convo.summary.substring(0,100)}{convo.summary.length > 100 ? '...' : ''}</p>
            )}
            {/* TODO: Could show a snippet of utterances if available in `convo` object */}
          </li>
        ))}
      </ul>
      {/* Placeholder for Facts and Todos if they were part of `data` object */}
      {/* {data.facts && data.facts.length > 0 && ( ... render facts ... )} */}
      {/* {data.todos && data.todos.length > 0 && ( ... render todos ... )} */}
    </div>
  );
};

export default BeeModule;
