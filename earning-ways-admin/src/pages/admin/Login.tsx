import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/hooks/use-toast';
import { rememberAdmin } from '@/lib/permissions';
import axios from 'axios';
import { Moon, Sun, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
const Login = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      navigate('/admin/dashboard');
    }
  }, [navigate]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // The API answers { token, admin: { id, email, name, role, permissions, mustChangePassword } }.
      const res = await api.post('/admin/login', { email, password });
      const token = res.data.token;
      if (token) {
        localStorage.setItem('admin_token', token);
        // The panel needs the role and the permission list to decide what to show;
        // the server checks the same list on every request.
        rememberAdmin({
          id: res.data.admin?.id,
          email: res.data.admin?.email,
          role: res.data.admin?.role,
          permissions: res.data.admin?.permissions,
          mustChangePassword: res.data.admin?.mustChangePassword,
        });
      }
      if (res.data.admin?.mustChangePassword) {
        toast({
          title: 'Set your own password',
          description: 'Open Team & Roles and change the temporary password you were given.',
        });
      }
      navigate('/admin/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      if (axios.isAxiosError(error)) {
        const responseMessage = error.response?.data?.message;
        const message =
          typeof responseMessage === 'string' && responseMessage.trim()
            ? responseMessage
            : error.message;
        toast({
          title: 'Login failed',
          description: message || 'Unable to sign in. Please check your credentials.',
        });
      } else {
        const message = error instanceof Error ? error.message : '';
        toast({
          title: 'Login failed',
          description: message || 'Unable to sign in. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full"
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </Button>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access the admin panel
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="text-right">
              <Button variant="link" className="px-0 text-sm">
                Forgot Password?
              </Button>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
export default Login;