import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UserProfile from '../components/UserProfile';

const UserProfilePage = () => {
  const { user } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();

  const resolvedUserId = useMemo(() => {
    if (userId && userId !== 'me') {
      const parsed = parseInt(userId, 10);
      return Number.isNaN(parsed) ? user?.id : parsed;
    }
    return user?.id;
  }, [userId, user]);

  if (!resolvedUserId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-600 text-center">
          Kein Benutzer ausgewählt oder keine Berechtigung.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <UserProfile userId={resolvedUserId} onClose={() => navigate(-1)} />
    </div>
  );
};

export default UserProfilePage;
