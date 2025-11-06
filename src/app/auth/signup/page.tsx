'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { GoogleLogo } from '@/components/icons/google-logo';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordMatch = useMemo(() => {
    return password && confirmPassword && password === confirmPassword;
  }, [password, confirmPassword]);

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordMatch) {
      alert("Passwords do not match.");
      return;
    }
    // Here you would handle the sign-up logic (API call, etc.)
    // On success, you might redirect to a confirmation page or directly to the app
    router.push('/');
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Create your workspace</h2>
        <p className="mt-2 text-muted-foreground">
          Sign up to design, connect, and automate your AI systems.
        </p>
      </div>
      <form className="space-y-3" onSubmit={handleSignUp}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="first-name">First name</Label>
            <Input id="first-name" name="first-name" autoComplete="given-name" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="last-name">Last name</Label>
            <Input id="last-name" name="last-name" autoComplete="family-name" required />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" name="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
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
        
        <div className="space-y-1">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <div className="relative">
            <Input id="confirm-password" name="confirm-password" type={showConfirmPassword ? 'text' : 'password'} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="sr-only">{showConfirmPassword ? 'Hide password' : 'Show password'}</span>
            </button>
          </div>
           {confirmPassword && passwordMatch && (
            <p className="text-sm text-green-500">Passwords match</p>
          )}
           {confirmPassword && !passwordMatch && (
            <p className="text-sm text-red-500">Passwords do not match</p>
          )}
        </div>
        
        <div className="space-y-3 pt-2">
          <div className="flex items-start">
            <Checkbox id="terms" required />
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="text-muted-foreground">
                I agree to the{' '}
                <Link href="#" className="font-medium text-primary hover:underline">
                  Terms
                </Link> & <Link href="#" className="font-medium text-primary hover:underline">
                  Privacy Policy
                </Link>.
              </label>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button type="submit" className="w-full">
            Create account
          </Button>
        </div>
      </form>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or</span>
        </div>
      </div>
      <div>
        <Button variant="outline" className="w-full">
          <GoogleLogo className="mr-2 h-4 w-4" />
          Sign up with Google
        </Button>
      </div>
      <p className="pt-4 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
