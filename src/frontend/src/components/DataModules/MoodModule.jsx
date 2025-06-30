import React from 'react';
import DateNormalizerFE from '../../utils/DateNormalizerFE';
import './Module.css'; // Shared module styles

const MoodModule = ({ data }) => {
  if (!data || data.mood_score === undefined) {
    return (
      <div className="data-module mood-module-styles small-square-module">
        <h3>Mood</h3>
        <p>No mood recorded for this day.</p>
      </div>
    );
  }

  // Helper to get an emoji or color based on mood score
  const getMoodIndicator = (score) => {
    if (score >= 8) return { emoji: '😄', color: '#4CAF50' }; // Green for high scores
    if (score >= 6) return { emoji: '😊', color: '#8BC34A' };
    if (score >= 4) return { emoji: '😐', color: '#FFC107' }; // Yellow for medium
    if (score >= 2) return { emoji: '😟', color: '#FF9800' }; // Orange for low
    return { emoji: '😢', color: '#F44336' }; // Red for very low
  };

  const indicator = getMoodIndicator(data.mood_score);

  return (
    <div className="data-module mood-module-styles small-square-module">
      <h3>Mood <span style={{ color: indicator.color, fontSize: '1.2em' }}>{indicator.emoji}</span></h3>
      <p><strong>Score:</strong> <span style={{ color: indicator.color, fontWeight: 'bold' }}>{data.mood_score}/10</span></p>
      {data.mood_text && <p><em>"{data.mood_text}"</em></p>}
      {data.notes && (
        <div className="content-preview">
          <strong>Notes:</strong> {data.notes}
        </div>
      )}
      {data.recorded_at && <p className="meta-info">Recorded at: {new Date(data.recorded_at).toLocaleTimeString()}</p>}
    </div>
  );
};

export default MoodModule;
