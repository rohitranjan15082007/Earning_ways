import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../api/apiClient';

const SETTINGS_QUERY_KEY = ['settings'];

const fetchSettings = async () => {
  const response = await api.get('/setting');
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to fetch settings');
  }
  return response.data.data;
};

const updateSettings = async (data) => {
  const response = await api.post('/setting/update/setting', data);
  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to update settings');
  }
  return response.data.data;
};

const SettingsPage = () => {
  const queryClient = useQueryClient();

  // 1. Added location to initial state
  const [formData, setFormData] = useState({
    phoneNumber: '',
    email: '',
    location: '',
    activeUser: '',
    totalUser: '',
    maxiumEarningReturn: '',
  });
  const [error, setError] = useState('');

  const { data: settingsData, isLoading: loading, error: fetchError } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (settingsData) {
      // 2. Map API data to state (handling null values)
      setFormData({
        phoneNumber: settingsData.phoneNumber || '',
        email: settingsData.email || '',
        location: settingsData.location || '',
        activeUser: settingsData.activeUser || '',
        totalUser: settingsData.totalUser || '',
        maxiumEarningReturn: settingsData.maxiumEarningReturn || '',
      });
    }
  }, [settingsData]);

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      toast.success('Settings updated successfully!');
      setError('');
    },
    onError: (err) => {
      const msg = err.message || 'An error occurred while updating';
      setError(msg);
      toast.error(msg);
    },
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // 3. Updated validation logic (optional: check if location is filled if you require it)
    if (!formData.email && !formData.phoneNumber && !formData.activeUser && !formData.totalUser && !formData.location) {
      toast.error('At least one field is required');
      return;
    }
    mutation.mutate(formData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-lg text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-md mx-auto bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Admin Settings</h1>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-muted-foreground mb-1">
              Phone Number
            </label>
            <input
              type="text"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-muted-foreground"
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-muted-foreground"
              placeholder="Enter email"
            />
          </div>

          {/* 4. New Location Input Field */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-muted-foreground mb-1">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-muted-foreground"
              placeholder="Enter office location"
            />
          </div>

          <div>
            <label htmlFor="activeUser" className="block text-sm font-medium text-muted-foreground mb-1">
              Active Users
            </label>
            <input
              type="number"
              id="activeUser"
              name="activeUser"
              value={formData.activeUser}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-muted-foreground"
              placeholder="Enter active users count"
              min="0"
            />
          </div>

          <div>
            <label htmlFor="totalUser" className="block text-sm font-medium text-muted-foreground mb-1">
              Total Users
            </label>
            <input
              type="number"
              id="totalUser"
              name="totalUser"
              value={formData.totalUser}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-muted-foreground"
              placeholder="Enter total users count"
              min="0"
            />
          </div>

          <div>
            <label htmlFor="maxiumEarningReturn" className="block text-sm font-medium text-muted-foreground mb-1">
              Maximum Earning Return (Multiplier)
            </label>
            <input
              type="number"
              id="maxiumEarningReturn"
              name="maxiumEarningReturn"
              value={formData.maxiumEarningReturn}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-muted-foreground"
              placeholder="e.g. 3 (Total Investment * 3)"
              min="0"
              step="0.1"
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Updating...' : 'Update Settings'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;