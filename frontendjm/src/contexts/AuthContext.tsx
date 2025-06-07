import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { authService } from '../services/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  transcript: string;
  transcriptHistory: TranscriptEntry[];
  isListening: boolean;
  captionStyle: CaptionStyle;
  startListening: () => void;
  stopListening: () => void;
  clearHistory: () => void;
  updateCaptionStyle: (style: Partial<CaptionStyle>) => void;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

// Define transcript history item type
interface TranscriptEntry {
  id: string;
  text: string;
}

// Define caption style type
interface CaptionStyle {
  fontSize: 'small' | 'medium' | 'large';
  color: string;
}

// Define context value shape



export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [transcript, setTranscript] = useState<string>('');
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptEntry[]>([]);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>({
    fontSize: 'medium',
    color: 'white'
  });

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition: SpeechRecognition | null = SpeechRecognition ? new SpeechRecognition() : null;

  if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const finalText = result[0].transcript;
          addToHistory(finalText);
        }
        currentTranscript += result[0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access to use speech recognition.');
      }
      // setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening) {
        recognition.start();
      }
    };
  }

  const startListening = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser');
      return;
    }

    setIsListening(true);
    setTranscript('');
    recognition.start();
  };

  const stopListening = () => {
    if (!recognition) return;

    setIsListening(false);
    recognition.stop();
  };

  const addToHistory = (text: string) => {
    if (!text.trim()) return;

    const newEntry: TranscriptEntry = {
      id: Date.now().toString(),
      text
    };
    setTranscriptHistory(prev => [newEntry, ...prev].slice(0, 50));
  };

  const clearHistory = () => {
    setTranscriptHistory([]);
  };

  const updateCaptionStyle = (style: Partial<CaptionStyle>) => {
    setCaptionStyle(prev => ({ ...prev, ...style }));
  };

  useEffect(() => {
    return () => {
      if (recognition && isListening) {
        recognition.stop();
      }
    };
  }, []);



  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser && storedUser !== 'undefined') {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        // Clear invalid data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      return () => {
        if (recognition && isListening) {
          recognition.stop();
        }
      };
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      const { token: newToken, user: userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const response = await authService.register(userData);
      const { token: newToken, user: newUser } = response.data;
      
      setToken(newToken);
      setUser(newUser);
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    isAuthenticated: !!token,
    transcript,
    transcriptHistory,
    isListening,
    captionStyle,
    startListening,
    stopListening,
    clearHistory,
    updateCaptionStyle
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};