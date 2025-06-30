import React from 'react';
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom';
import './App.css';
import MonthlyCalendar from './components/CalendarView/MonthlyCalendar';
import DailyNewspaper from './components/CalendarView/DailyNewspaper';
import FloatingChatWidget from './components/ChatInterface/FloatingChat'; // Import the chat widget

// Placeholder components for routing - to be created in later steps
// const MonthlyCalendarView = () => <h2>Monthly Calendar View (Placeholder)</h2>; // Replaced
// const DailyNewspaperView = () => <h2>Daily Newspaper View (Placeholder)</h2>; // Replaced

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="main-nav">
          <ul>
            <li>
              <Link to="/">Monthly View</Link>
            </li>
            {/* Example: Link to today's daily view if needed */}
            {/* <li>
              <Link to={`/day/${new Date().toISOString().split('T')[0]}`}>Today's View</Link>
            </li> */}
          </ul>
        </nav>

        <main className="content-area">
          <Switch>
            {/* Route for daily view, e.g., /day/2023-10-26 */}
            <Route path="/day/:date" component={DailyNewspaper} />

            {/* Default route to monthly calendar */}
            <Route path="/" exact component={MonthlyCalendar} />
          </Switch>
        </main>

        {/* FloatingChat component will be added here or in a global layout wrapper later */}
        <FloatingChatWidget />
      </div>
    </Router>
  );
}

export default App;
