import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { config } from '@/lib/config';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(username, password);
      if (success) {
        navigate('/worklist');
      } else {
        setError('Invalid credentials. Please try again.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:flex-1 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-secondary opacity-90" />
        <div className="relative z-10 flex flex-col justify-center px-12 text-primary-foreground">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-14 w-14 rounded-xl bg-primary-foreground/20 backdrop-blur flex items-center justify-center">
              <Activity className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{config.app.name}</h1>
              <p className="text-primary-foreground/80">{config.app.institution}</p>
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <h2 className="text-2xl font-semibold">
              Medical Imaging Worklist
            </h2>
            <p className="text-primary-foreground/80 leading-relaxed">
              Access your radiology worklist with a modern, intuitive interface. 
              View studies, manage workflows, and launch DICOM viewers seamlessly.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="bg-primary-foreground/10 backdrop-blur rounded-lg p-4">
                <p className="text-2xl font-bold">OHIF</p>
                <p className="text-sm text-primary-foreground/70">Viewer Integration</p>
              </div>
              <div className="bg-primary-foreground/10 backdrop-blur rounded-lg p-4">
                <p className="text-2xl font-bold">Stone</p>
                <p className="text-sm text-primary-foreground/70">Web Viewer</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute top-20 -left-10 h-60 w-60 rounded-full bg-primary-foreground/5 blur-2xl" />
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{config.app.name}</h1>
              <p className="text-sm text-muted-foreground">{config.app.institution}</p>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-medical-lg border border-border p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold">Welcome Back</h2>
              <p className="text-muted-foreground mt-2">
                Sign in to access the PACS worklist
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm animate-fade-in">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Protected health information. Authorized users only.
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} {config.app.institution}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
