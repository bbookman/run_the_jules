import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../services/api';
import './FloatingChat.css';

const FloatingChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    // Initial message from AI
    { id: 'init', text: "Hello! How can I help you explore your Lifeboard today?", sender: 'ai', timestamp: new Date() }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null); // For scrolling to bottom

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]); // Scroll whenever messages change

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (inputText.trim() === '') return;

    const userMessage = {
      id: `msg-${Date.now()}-user`,
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Send message to backend
      const response = await apiClient.post('/chat/message', {
        message: userMessage.text,
        context: {
          // Add any relevant context, e.g., current view, date, etc.
          // For MVP, context might be simple or empty.
          // currentDate: "2023-10-27",
          // viewType: "dailyNewspaper"
        }
      });

      const aiResponse = {
        id: `msg-${Date.now()}-ai`,
        text: response.data.response,
        sender: 'ai',
        timestamp: new Date(response.data.timestamp || Date.now()),
        sources: response.data.sources, // Optional sources from AI
      };
      setMessages(prevMessages => [...prevMessages, aiResponse]);

    } catch (error) {
      console.error('Failed to send chat message:', error);
      const errorResponse = {
        id: `msg-${Date.now()}-error`,
        text: "Sorry, I couldn't connect to the chat service. Please try again later.",
        sender: 'ai', // Or 'system-error'
        timestamp: new Date(),
      };
      setMessages(prevMessages => [...prevMessages, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  // Render a single message
  const Message = ({ msg }) => (
    <div className={`message ${msg.sender}`}>
      {msg.text}
      <span className="timestamp">
        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      {/* Optionally display sources if any */}
      {/* {msg.sources && msg.sources.length > 0 && (
        <div className="message-sources">Sources: {JSON.stringify(msg.sources)}</div>
      )} */}
    </div>
  );

  if (!isOpen) {
    return (
      <div className="floating-chat-widget closed">
        <button onClick={toggleChat} className="chat-toggle-button" aria-label="Open chat">
          💬 {/* Chat icon, could be an SVG */}
        </button>
      </div>
    );
  }

  return (
    <div className="floating-chat-widget open">
      <div className="chat-header">
        <span>Lifeboard Assistant</span>
        <button onClick={toggleChat} className="close-chat-button" aria-label="Close chat">&times;</button>
      </div>

      <div className="message-history">
        {messages.map(msg => <Message key={msg.id} msg={msg} />)}
        <div ref={messagesEndRef} /> {/* Anchor for scrolling */}
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-area">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="Ask about your day..."
          disabled={isLoading}
          aria-label="Chat input"
        />
        <button type="submit" disabled={isLoading || inputText.trim() === ''}>
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default FloatingChatWidget;
