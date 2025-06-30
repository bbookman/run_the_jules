import React from 'react';
import './Module.css'; // Shared module styles

const WeatherModule = ({ data }) => {
  if (!data) {
    return (
      <div className="data-module weather-module-styles small-square-module">
        <h3>Weather</h3>
        <p>No weather data available for this day.</p>
      </div>
    );
  }

  // Map OpenWeatherMap icon codes to weather icons (e.g., using an icon font or SVGs)
  // For MVP, just display text.
  const getWeatherIcon = (iconCode) => {
    if (!iconCode) return '';
    // Example: return <i className={`owi owi-${iconCode}`}></i>;
    // Or map to simple emojis for MVP
    const iconMap = {
        '01d': '☀️', '01n': '🌙', // clear sky
        '02d': '⛅️', '02n': '☁️🌙', // few clouds
        '03d': '☁️', '03n': '☁️',   // scattered clouds
        '04d': '☁️☁️', '04n': '☁️☁️', // broken clouds
        '09d': '🌧️', '09n': '🌧️',   // shower rain
        '10d': '🌦️', '10n': '🌧️🌙', // rain
        '11d': '⛈️', '11n': '⛈️',   // thunderstorm
        '13d': '❄️', '13n': '❄️',   // snow
        '50d': '🌫️', '50n': '🌫️',   // mist
    };
    return iconMap[iconCode] || '';
  };


  return (
    <div className="data-module weather-module-styles small-square-module">
      <h3>Weather {getWeatherIcon(data.icon_code)}</h3>
      <p><strong>Condition:</strong> {data.condition || 'N/A'} ({data.description || 'N/A'})</p>
      <p><strong>High:</strong> {data.temperature_high !== undefined ? `${data.temperature_high}°` : 'N/A'}</p>
      <p><strong>Low:</strong> {data.temperature_low !== undefined ? `${data.temperature_low}°` : 'N/A'}</p>
      {data.humidity !== undefined && <p><strong>Humidity:</strong> {data.humidity}%</p>}
      {data.sunrise && <p className="meta-info">Sunrise: {new Date(data.sunrise).toLocaleTimeString()}</p>}
      {data.sunset && <p className="meta-info">Sunset: {new Date(data.sunset).toLocaleTimeString()}</p>}
    </div>
  );
};

export default WeatherModule;
