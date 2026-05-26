import React, { useEffect, useState } from 'react';
import {
  acceptFriendRequest,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
  getFriendRequests,
} from '../services/socialService';
import getErrorMessage from '../utils/getErrorMessage';

const FriendRequestsPanel = ({ onFriendsChanged }) => {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const data = await getFriendRequests();
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
      setFriendCount(data.friendCount ?? 0);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await searchUsers(search.trim());
        setResults(data.users || []);
      } catch {
        setResults([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const handleSend = async (userId) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await sendFriendRequest({ userId });
      setSuccess('Friend request sent!');
      setSearch('');
      setResults([]);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || getErrorMessage(err, 'Request failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id) => {
    try {
      await acceptFriendRequest(id);
      await load();
      onFriendsChanged?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not accept.'));
    }
  };

  const handleReject = async (id) => {
    try {
      await rejectFriendRequest(id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reject.'));
    }
  };

  return (
    <aside className="friends-panel">
      <h3>Friends</h3>
      <p className="friends-count">
        <strong>{friendCount}</strong> friends
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="friend-add">
        <label htmlFor="friend-search">Add friend (name or email)</label>
        <input
          id="friend-search"
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="friend-search-results">
            {results.map((u) => (
              <li key={u._id}>
                <span>{u.name}</span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => handleSend(u._id)}
                  disabled={loading}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {incoming.length > 0 && (
        <div className="friend-section">
          <h4>Incoming requests</h4>
          <ul className="friend-request-list">
            {incoming.map((r) => (
              <li key={r._id} className="friend-request-item">
                <span>{r.fromUser?.name}</span>
                <div className="friend-request-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleAccept(r._id)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleReject(r._id)}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="friend-section">
          <h4>Sent requests</h4>
          <ul className="friend-request-list pending">
            {outgoing.map((r) => (
              <li key={r._id}>{r.toUser?.name} — pending</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};

export default FriendRequestsPanel;
