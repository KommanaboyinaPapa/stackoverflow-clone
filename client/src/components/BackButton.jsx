import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/BackButton.css';

const BackButton = ({ className = '' }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <button
      className={`back-button ${className}`}
      onClick={handleBack}
      aria-label="Go back to previous page"
      title="Go back"
    >
      ← Back
    </button>
  );
};

export default BackButton;
