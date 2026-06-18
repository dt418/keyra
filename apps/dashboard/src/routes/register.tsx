import { useState, useEffect } from 'react';
import { Button, Input, Label, PasswordInput } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/error-message';
import { Key, Loader2, ArrowRight, Shield, Zap, BarChart3 } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.title = 'Create account · Keyra';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, name);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Registration failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-purple-500/10">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid-16" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Key className="h-5 w-5" />
            </div>
            <span className="font-semibold text-lg">Keyra</span>
          </div>
          <div className="space-y-8 max-w-md">
            <h1 className="text-4xl font-semibold tracking-tight">
              Start managing licenses in minutes.
            </h1>
            <p className="text-lg text-muted-foreground">
              Join thousands of developers using Keyra to ship software with confidence.
            </p>
            <div className="space-y-3 pt-4">
              {[
                { icon: Zap, title: '5-Minute Setup', desc: 'Create your first product instantly' },
                { icon: Shield, title: 'Bank-Grade Security', desc: 'AES-256 encryption, SOC2 ready' },
                { icon: BarChart3, title: 'Built-in Analytics', desc: 'Track everything that matters' },
              ].map((feature) => (
                <div key={feature.title} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background border border-border">
                    <feature.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{feature.title}</div>
                    <div className="text-xs text-muted-foreground">{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Free for personal use. No credit card required.
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
            <p className="text-sm text-muted-foreground">Get started in seconds</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                autoComplete="name"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              By creating an account, you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>

          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
