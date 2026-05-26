import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import LanguageOtpModal from './components/LanguageOtpModal';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import AskQuestion from './pages/AskQuestion';
import Questions from './pages/Questions';
import QuestionDetail from './pages/QuestionDetail';
import Profile from './pages/Profile';
import Social from './pages/Social';
import SubscriptionPlans from './pages/SubscriptionPlans';
import './App.css';
import './styles/polish.css';
import './styles/language.css';
import './styles/loginSecurity.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
        <Navbar />
        <LanguageOtpModal />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/questions" element={<Questions />} />
            <Route path="/questions/:id" element={<QuestionDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/subscriptions" element={<SubscriptionPlans />} />
            <Route
              path="/ask"
              element={
                <ProtectedRoute>
                  <AskQuestion />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/social"
              element={
                <ProtectedRoute>
                  <Social />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
