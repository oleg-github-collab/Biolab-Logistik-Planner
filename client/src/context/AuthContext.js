import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { getUser } from '../utils/api';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      };
    case 'LOAD_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        loading: false,
      };
    case 'USER_ERROR':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const initialState = {
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: false,
    loading: true,
  };

  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const loadUser = async () => {
      if (state.token) {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
          const res = await getUser();
          dispatch({ type: 'LOAD_USER', payload: res.data });
        } catch (err) {
          console.error('Error loading user:', err);
          // Only logout if it's an auth error (401 or 403)
          if (err.response?.status === 401 || err.response?.status === 403) {
            dispatch({ type: 'USER_ERROR' });
            localStorage.removeItem('token');
          }
        }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    loadUser();
  }, [state.token]);

  const login = (token, user) => {
    localStorage.setItem('token', token);
    dispatch({ type: 'LOGIN', payload: { token, user } });
  };

  const logout = () => {
    localStorage.removeItem('token');
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);