import React, { useState, useEffect } from 'react';
import { Link, useHistory } from 'react-router-dom';
import apiClient from '../../services/api'; // To be created
import DateNormalizerFE from '../../utils/DateNormalizerFE'; // To be created
import './MonthlyCalendar.css'; // To be created

const MonthlyCalendar = () => {
  const history = useHistory();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthData, setMonthData] = useState([]); // Stores day objects with data indicators
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const currentMonth = currentDate.getMonth() + 1; // 1-indexed
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    const fetchMonthData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.get(`/calendar/month/${currentYear}/${currentMonth}`);
        // Sort data by date to ensure correct rendering (though backend should ideally sort)
        const sortedDays = response.data.days.sort((a, b) => new Date(a.date) - new Date(b.date));
        setMonthData(sortedDays);

        // If PRD says "opens to most recent day that has data"
        // This logic is slightly simplified for MVP. A more robust way would be to get this from backend.
        if (response.data.days && response.data.days.length > 0 && history.location.pathname === '/') {
            const todayStr = DateNormalizerFE.formatDateToYYYYMMDD(new Date());
            const todayData = response.data.days.find(d => d.date === todayStr && d.hasData);
            if (todayData) {
                // history.push(`/day/${todayStr}`); // Navigate if today has data
            } else {
                // Find the most recent day in the current month with data
                const recentDayWithData = [...response.data.days] // Create a copy before sorting
                    .filter(d => d.hasData)
                    .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
                if (recentDayWithData) {
                    // history.push(`/day/${recentDayWithData.date}`); // Navigate to most recent day with data
                }
            }
        }

      } catch (err) {
        setError(err.message || 'Failed to fetch month data.');
        logger.error('Failed to fetch month data:', err); // Assuming global logger or use console.error
      } finally {
        setIsLoading(false);
      }
    };

    fetchMonthData();
  }, [currentYear, currentMonth, history]);

  const daysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate(); // Month is 1-indexed here
  };

  const getDayOfWeek = (year, month, day) => {
    return new Date(year, month - 1, day).getDay(); // 0 (Sun) to 6 (Sat), month 0-indexed
  };

  const renderCalendarDays = () => {
    const totalDays = daysInMonth(currentYear, currentMonth);
    const firstDayOfMonth = getDayOfWeek(currentYear, currentMonth, 1); // 0 for Sunday, 1 for Monday etc.
    const daysArray = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      daysArray.push(<div key={`empty-start-${i}`} className="calendar-day empty"></div>);
    }

    // Add actual days of the month
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayInfo = monthData.find(d => d.date === dateStr);
      const today = new Date();
      const isToday = day === today.getDate() && currentMonth === (today.getMonth() + 1) && currentYear === today.getFullYear();

      let dayClass = 'calendar-day';
      if (isToday) dayClass += ' today';
      if (dayInfo?.hasData) dayClass += ' has-data';
      if (dayInfo?.dataTypes?.includes('limitless')) dayClass += ' data-limitless';
      if (dayInfo?.dataTypes?.includes('bee')) dayClass += ' data-bee';
      if (dayInfo?.dataTypes?.includes('weather')) dayClass += ' data-weather';
      if (dayInfo?.dataTypes?.includes('mood')) dayClass += ' data-mood';

      daysArray.push(
        <Link key={dateStr} to={`/day/${dateStr}`} className={dayClass} title={dayInfo?.entryCount ? `${dayInfo.entryCount} entries` : ''}>
          <div className="day-number">{day}</div>
          {dayInfo?.hasData && (
            <div className="data-indicators">
              {/* Render small dots or icons for dataTypes */}
              {dayInfo.dataTypes.map(type => (
                <span key={type} className={`indicator ${type}-indicator`} title={type}></span>
              ))}
            </div>
          )}
        </Link>
      );
    }

    // Add empty cells to fill the last week
    const totalCells = firstDayOfMonth + totalDays;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
        daysArray.push(<div key={`empty-end-${i}`} className="calendar-day empty"></div>);
    }

    return daysArray;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 2, 1)); // Month is 0-indexed for Date constructor
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth, 1)); // Month is 0-indexed
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (isLoading) return <p>Loading calendar...</p>;
  if (error) return <p>Error loading calendar: {error}</p>;

  return (
    <div className="monthly-calendar-container">
      <div className="calendar-header">
        <button onClick={prevMonth}>&lt; Prev</button>
        <h2>{currentDate.toLocaleString('default', { month: 'long' })} {currentYear}</h2>
        <button onClick={nextMonth}>Next &gt;</button>
      </div>
      <div className="calendar-grid">
        {weekDays.map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
        ))}
        {renderCalendarDays()}
      </div>
    </div>
  );
};

export default MonthlyCalendar;
