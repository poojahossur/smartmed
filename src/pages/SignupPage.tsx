import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pill, Mail, Lock, User, Phone, ArrowRight } from "lucide-react";
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, UserRole } from "../types";

export default function SignupPage({ onSignup }: { onSignup: (user: UserProfile) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignup = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, "users", result.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        onSignup(userData);
        navigate("/dashboard");
      } else {
        const newUser: UserProfile = {
          uid: result.user.uid,
          email: result.user.email || "",
          displayName: result.user.displayName || "New User",
          phoneNumber: "",
          role: "patient",
          allergies: [],
          chronicConditions: [],
          age: 30,
          currentMedications: [],
          isOnboarded: false,
        };
        await setDoc(doc(db, "users", newUser.uid), newUser);
        onSignup(newUser);
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign up with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user: UserProfile = {
        uid: userCredential.user.uid,
        email,
        displayName: name,
        phoneNumber: phone,
        role: 'patient',
        allergies: [],
        chronicConditions: [],
        age: 30,
        currentMedications: [],
        isOnboarded: false,
      };
      
      await setDoc(doc(db, "users", user.uid), user);
      localStorage.setItem('user', JSON.stringify(user));
      onSignup(user);
      navigate("/dashboard");
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError(
          <span>
            Email signup is disabled. 
            <a href="https://console.firebase.google.com/project/gen-lang-client-0424554270/authentication/providers" target="_blank" rel="noopener noreferrer" className="underline ml-1">
              Click here to enable it
            </a> or use Google Login.
          </span>
        );
      } else if (err.code === 'auth/email-already-in-use') {
        setError("This email is already in use. Please try logging in instead.");
      } else if (err.code === 'auth/invalid-email') {
        setError("The email address is badly formatted.");
      } else if (err.code === 'auth/weak-password') {
        setError("The password is too weak.");
      } else {
        setError(err.message || "Failed to create account.");
      }
      console.error("Signup error:", err);
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
          
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Create Account</h2>
          <p className="text-slate-500 mb-8 text-center">Join the smart healthcare community</p>
          
          {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}
          
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-semibold hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Sign up with Google
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">Or use email</span>
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="+1234567890"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              >
                {loading ? "Creating Account..." : "Sign Up with Email"} <ArrowRight size={20} />
              </button>
            </form>
          </div>
          
          <div className="mt-8 text-center text-slate-500 text-sm">
            Already have an account? <Link to="/login" className="text-blue-600 font-semibold hover:underline">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
