/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import PatientDashboard from "./pages/PatientDashboard";
import MedicineFinder from "./pages/MedicineFinder";
import SubstitutionEngine from "./pages/SubstitutionEngine";
import OnboardingPage from "./pages/OnboardingPage";
import LogsPage from "./pages/LogsPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import FAQPage from "./pages/FAQPage";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import VoiceAssistant from "./components/VoiceAssistant";
import NotificationOverlay from "./components/NotificationOverlay";
import { UserProfile } from "./types";

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserProfile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    setUser(null);
    localStorage.removeItem('user');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const showOnboarding = user && user.role === 'patient' && !user.isOnboarded;

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        {user && !showOnboarding && <Navbar user={user} onLogout={handleLogout} />}
        
        <div className="flex">
          {user && !showOnboarding && <Sidebar user={user} />}
          
          <main className={user && !showOnboarding ? "flex-1 p-4 md:p-8" : "w-full"}>
            <Routes>
              <Route path="/" element={user ? (showOnboarding ? <Navigate to="/onboarding" /> : <Navigate to="/dashboard" />) : <LandingPage />} />
              <Route path="/login" element={<LoginPage onLogin={setUser} />} />
              <Route path="/signup" element={<SignupPage onSignup={setUser} />} />
              
              {/* Onboarding */}
              <Route path="/onboarding" element={user && user.role === 'patient' ? <OnboardingPage user={user} onComplete={setUser} /> : <Navigate to="/login" />} />

              {/* Protected Routes */}
              <Route path="/dashboard" element={user?.role === 'patient' ? (showOnboarding ? <Navigate to="/onboarding" /> : <PatientDashboard user={user} />) : <Navigate to="/login" />} />
              <Route path="/medicine-finder" element={user ? (showOnboarding ? <Navigate to="/onboarding" /> : <MedicineFinder />) : <Navigate to="/login" />} />
              <Route path="/substitution" element={user ? (showOnboarding ? <Navigate to="/onboarding" /> : <SubstitutionEngine user={user} />) : <Navigate to="/login" />} />
              <Route path="/logs" element={user ? (showOnboarding ? <Navigate to="/onboarding" /> : <LogsPage />) : <Navigate to="/login" />} />
              
              {/* Static Pages */}
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/faq" element={<FAQPage />} />
            </Routes>
          </main>
        </div>
        
        {user && <VoiceAssistant />}
        <NotificationOverlay />
      </div>
    </Router>
  );
}

