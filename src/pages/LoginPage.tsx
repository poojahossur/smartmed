import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pill, Mail, Lock, ArrowRight } from "lucide-react";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile } from "../types";

export default function LoginPage({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, "users", result.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        onLogin(userData);
        navigate("/dashboard");
      } else {
        // Create a default profile if it doesn't exist
        const newUser: UserProfile = {
          uid: result.user.uid,
          email: result.user.email || "",
          displayName: result.user.displayName || "New User",
          phoneNumber: "",
          role: "patient",
          allergies: [],
          age: 30,
          currentMedications: [],
        };
        await setDoc(doc(db, "users", newUser.uid), newUser);
        onLogin(newUser);
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to login with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        localStorage.setItem('user', JSON.stringify(userData));
        onLogin(userData);
        navigate("/dashboard");
      } else {
        setError("User profile not found.");
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError(
          <span>
            Email login is disabled. 
            <a href="https://console.firebase.google.com/project/gen-lang-client-0424554270/authentication/providers" target="_blank" rel="noopener noreferrer" className="underline ml-1">
              Click here to enable it
            </a> or use Google Login.
          </span>
        );
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password. Please try again.");
      } else if (err.code === 'auth/invalid-email') {
        setError("The email address is badly formatted.");
      } else {
        setError(err.message || "Failed to login.");
      }
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200 overflow-hidden">
        <div className="p-8 md:p-12">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <Pill className="text-blue-600" size={32} />
            <span className="text-2xl font-bold tracking-tight text-slate-900">SmartMed</span>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Welcome Back</h2>
          <p className="text-slate-500 mb-8 text-center">Sign in to manage your medicines</p>
          
          {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}
          
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-semibold hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Continue with Google
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">Or use email</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="name@example.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Logging in..." : "Login with Email"} <ArrowRight size={20} />
              </button>
            </form>
          </div>
          
          <div className="mt-8 text-center text-slate-500 text-sm">
            Don't have an account? <Link to="/signup" className="text-blue-600 font-semibold hover:underline">Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
