import { getApiBaseUrl } from './apiBaseUrl';

const getHeaders = () => {
    const token = localStorage.getItem('noxis_auth_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

const apiCall = async (endpoint, options = {}) => {
    const API_URL = getApiBaseUrl();
    const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: { ...getHeaders(), ...(options.headers || {}) }
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Network error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
};

export const friendsService = {
    // Profile
    getMyProfile: () => apiCall('/api/profile/me'),
    updateProfile: (data) => apiCall('/api/profile/update', {
        method: 'POST', body: JSON.stringify(data)
    }),
    getUserProfile: (username) => apiCall(`/api/profile/${encodeURIComponent(username)}`),

    // Friends
    searchUsers: (query) => apiCall(`/api/friends/search?q=${encodeURIComponent(query)}`),
    sendRequest: (username) => apiCall('/api/friends/request', {
        method: 'POST', body: JSON.stringify({ username })
    }),
    acceptRequest: (requestId) => apiCall('/api/friends/accept', {
        method: 'POST', body: JSON.stringify({ requestId })
    }),
    rejectRequest: (requestId) => apiCall('/api/friends/reject', {
        method: 'POST', body: JSON.stringify({ requestId })
    }),
    removeFriend: (username) => apiCall('/api/friends/remove', {
        method: 'POST', body: JSON.stringify({ username })
    }),
    getFriendsList: () => apiCall('/api/friends/list'),
    getPendingRequests: () => apiCall('/api/friends/requests'),
    updateActivity: (data) => apiCall('/api/friends/activity', {
        method: 'POST', body: JSON.stringify(data)
    }),

    // Notifications
    getNotifications: () => apiCall('/api/notifications'),
    sendRecommendation: (data) => apiCall('/api/notifications/recommend', {
        method: 'POST', body: JSON.stringify(data)
    }),
    markNotificationsRead: () => apiCall('/api/notifications/read', {
        method: 'POST'
    }),

    // Watchlists
    getWatchlists: () => apiCall('/api/watchlists'),
    createWatchlist: (data) => apiCall('/api/watchlists', {
        method: 'POST', body: JSON.stringify(data)
    }),
    addToWatchlist: (listId, item) => apiCall(`/api/watchlists/${listId}/add`, {
        method: 'POST', body: JSON.stringify({ item })
    }),
    getAiSuggestions: (listId) => apiCall(`/api/watchlists/${listId}/ai-suggest`, {
        method: 'POST'
    }),
    inviteToWatchlist: (listId, friendId) => apiCall(`/api/watchlists/${listId}/invite`, {
        method: 'POST', body: JSON.stringify({ friendId })
    }),
    removeFromWatchlist: (listId, itemId) => apiCall(`/api/watchlists/${listId}/remove`, {
        method: 'POST', body: JSON.stringify({ itemId })
    }),
    deleteWatchlist: (listId) => apiCall(`/api/watchlists/${listId}`, {
        method: 'DELETE'
    })
};
