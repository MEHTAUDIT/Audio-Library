import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getAuthRedirectPath, setAuthLandingPath, useAuth } from '../../lib/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

const loginSchema = z.object({
  subdomain: z.string().optional(),
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('expired') === 'true';
  const { login } = useAuth();
  const [loginType, setLoginType] = useState<'choose' | 'tenant' | 'user'>('choose');

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: LoginFormValues) => {
      // Only set tenant header when provided (tenant sign-in)
      const headers: Record<string, string> | undefined = data.subdomain ? { 'X-Tenant-ID': data.subdomain } : undefined;
      return api.post('/auth/login', { email: data.email, password: data.password }, headers ? { headers } : undefined);
    },
    onSuccess: (response, variables) => {
      const nextPath = getAuthRedirectPath(response.data.token);
      setAuthLandingPath(nextPath);
      login(response.data.token, variables.subdomain || 'demo');
      navigate(nextPath, { replace: true });
    },
    onError: (error: any) => {
      alert("Login failed: " + (error.response?.data?.message || "Invalid credentials"));
    }
  });

  const onSubmit = (data: LoginFormValues) => {
    // Validate required subdomain for tenant sign-in
    if (loginType === 'tenant') {
      if (!data.subdomain || data.subdomain.length < 2) {
        alert('Please enter your tenant subdomain to sign in as a tenant.');
        return;
      }
    }

    // For user sign-in, omit X-Tenant-ID so default tenant (demo) is used by api
    if (loginType === 'user') {
      // ensure subdomain is undefined
      data.subdomain = undefined;
    }

    mutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
          {sessionExpired && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <p className="text-amber-800 text-sm">
                Your session has expired due to inactivity. Please sign in again.
              </p>
            </div>
          )}
        </div>

        {/* Choice screen */}
        {loginType === 'choose' ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">How would you like to sign in?</p>
            <div className="grid gap-3">
              <button
                onClick={() => setLoginType('tenant')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sign in as Tenant (admin)
              </button>
              <button
                onClick={() => setLoginType('user')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-500 text-white px-4 py-3 text-sm font-medium hover:opacity-95"
              >
                Sign in as User (listener)
              </button>
            </div>
            <div className="text-center text-sm">
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
                Don't have an account? Register
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4 rounded-md shadow-sm">
              {loginType === 'tenant' && (
                <div>
                  <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">Tenant Subdomain</label>
                  <Input id="subdomain" {...form.register("subdomain")} placeholder="demo" className="mt-1" />
                  {form.formState.errors.subdomain && <p className="text-red-500 text-xs mt-1">{form.formState.errors.subdomain.message}</p>}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
                <Input id="email" type="email" {...form.register("email")} placeholder="you@example.com" className="mt-1" />
                {form.formState.errors.email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>}
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <Input id="password" type="password" {...form.register("password")} className="mt-1" />
                {form.formState.errors.password && <p className="text-red-500 text-xs mt-1">{form.formState.errors.password.message}</p>}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={mutation.isLoading}>
                {mutation.isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
              <button
                type="button"
                onClick={() => setLoginType('choose')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
            </div>

            <div className="text-center text-sm">
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
                Don't have an account? Register
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
