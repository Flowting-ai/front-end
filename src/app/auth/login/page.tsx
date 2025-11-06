'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { GoogleLogo } from '@/components/icons/google-logo';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate successful login by setting a flag in localStorage
    localStorage.setItem('isLoggedIn', 'true');
    // On success, redirect to the main app
    router.push('/');
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Access your intelligent workspace</h2>
        <p className="mt-2 text-muted-foreground">
          Log in to design, connect, and automate your AI systems, all in one place.
        </p>
      </div>
      <form className="space-y-6" onSubmit={handleSignIn}>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="#" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input id="password" name="password" type={showPassword ? 'text' : 'password'} required />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
            </button>
          </div>
        </div>

        <div>
          <Button type="submit" className="w-full">
            Log in
          </Button>
        </div>
      </form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>
      <div>
        <Button variant="outline" className="w-full">
          <GoogleLogo className="mr-2 h-4 w-4" />
          Log in with Google
        </Button>
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="font-semibold text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
