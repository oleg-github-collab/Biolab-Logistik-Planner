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
  const token = localStorage.getItem('token');

  const initialState = {
    user: null,
    token: token,
    isAuthenticated: !!token, // If we have a token, assume authenticated until proven otherwise
    loading: !!token, // Only loading if we have a token to validate
  };

  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const loadUser = async () => {
      if (state.token) {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
          const res = await getUser();
          if (res && res.data) {
            dispatch({ type: 'LOAD_USER', payload: res.data });
          } else {
            console.error('Invalid response from getUser');
            dispatch({ type: 'USER_ERROR' });
            localStorage.removeItem('token');
          }
        } catch (err) {
          console.error('Error loading user:', err);
          // Logout on any auth error
          console.log('Authentication error, logging out');
          dispatch({ type: 'USER_ERROR' });
          localStorage.removeItem('token');
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

  const hasRole = (roles) => {
    if (!state.user?.role) return false;
    if (Array.isArray(roles)) {
      return roles.includes(state.user.role);
    }
    return state.user.role === roles;
  };

  const canAssignTasks = () => {
    return hasRole(['admin', 'superadmin']);
  };

  const canManageUsers = () => {
    return hasRole(['admin', 'superadmin']);
  };

  const isEmployee = () => {
    return hasRole('employee');
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      hasRole,
      canAssignTasks,
      canManageUsers,
      isEmployee
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);