import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../../services/api'; // To be created
import DateNormalizerFE from '../../utils/DateNormalizerFE'; // To be created
import './DailyNewspaper.css'; // To be created

// Import actual module components
import LimitlessModule from '../DataModules/LimitlessModule';
import BeeModule from '../DataModules/BeeModule';
import WeatherModule from '../DataModules/WeatherModule';
import MoodModule from '../DataModules/MoodModule';


const DailyNewspaper = () => {
  const { date } = useParams(); // Date from URL in YYYY-MM-DD format
  const [dayData, setDayData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!date || !DateNormalizerFE.isValidYYYYMMDD(date)) {
      setError('Invalid date format in URL.');
      setIsLoading(false);
      return;
    }

    const fetchDayData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.get(`/calendar/day/${date}`);
        setDayData(response.data);
      } catch (err) {
        setError(err.message || `Failed to fetch data for ${date}.`);
        console.error(`Failed to fetch data for ${date}:`, err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDayData();
  }, [date]);

  if (isLoading) return <p>Loading day data for {date}...</p>;
  if (error) return <p>Error: {error} (Date: {date})</p>;
  if (!dayData) return <p>No data found for {date}.</p>;

  // Fixed layout as per PRD: Limitless (vertical), Bee (vertical), Mood (small square), Weather (small square)
  // This requires specific CSS for positioning and sizing.
  return (
    <div className="daily-newspaper-container">
      <div className="daily-header">
        <h1>Lifeboard for {DateNormalizerFE.formatDateReadable(dayData.date)}</h1>
        <Link to="/">Back to Calendar</Link>
      </div>

      {dayData.aiSummary && (
        <div className="ai-summary-module">
          <h2>Daily Summary</h2>
          <p>{dayData.aiSummary}</p>
        </div>
      )}

      <div className="modules-grid">
        {/* Column 1: Limitless and Mood */}
        <div className="module-column">
          <LimitlessModule data={dayData.modules?.limitless} />
          <MoodModule data={dayData.modules?.mood} />
        </div>

        {/* Column 2: Bee and Weather */}
        <div className="module-column">
          <BeeModule data={dayData.modules?.bee} />
          <WeatherModule data={dayData.modules?.weather} />
        </div>
      </div>

      {/* Raw data for debugging (optional) */}
      {/* <pre className="raw-data-debug">{JSON.stringify(dayData, null, 2)}</pre> */}
    </div>
  );
};

export default DailyNewspaper;
