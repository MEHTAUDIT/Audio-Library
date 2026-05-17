import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

const loginSchema = z.object({
  subdomain: z.string().min(2, "Tenant subdomain is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('expired') === 'true';
  const { login, isAuthenticated } = useAuth();

  // Navigate after auth state has propagated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: LoginFormValues) => {
      return api.post('/auth/login', { email: data.email, password: data.password }, { headers: { "X-Tenant-ID": data.subdomain } });
    },
    onSuccess: (response) => {
      login(response.data.token);
      // Navigation handled by useEffect above after isAuthenticated state updates
    },
    onError: (error: any) => {
      alert("Login failed: " + (error.response?.data?.message || "Invalid credentials"));
    }
  });

  const onSubmit = (data: LoginFormValues) => {
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
        <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">Tenant Subdomain</label>
              <Input id="subdomain" {...form.register("subdomain")} placeholder="demo" className="mt-1" />
              {form.formState.errors.subdomain && <p className="text-red-500 text-xs mt-1">{form.formState.errors.subdomain.message}</p>}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
              <Input id="email" type="email" {...form.register("email")} placeholder="admin@acme.com" className="mt-1" />
              {form.formState.errors.email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <Input id="password" type="password" {...form.register("password")} className="mt-1" />
              {form.formState.errors.password && <p className="text-red-500 text-xs mt-1">{form.formState.errors.password.message}</p>}
            </div>
          </div>

          <div>
            <Button type="submit" className="w-full" disabled={mutation.isLoading}>
              {mutation.isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
          
          <div className="text-center space-y-2">
            <div className="text-sm">
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
                Don't have an account? Create one
              </Link>
            </div>
            <div className="text-sm">
              <Link to="/signup" className="font-medium text-gray-500 hover:text-gray-700">
                Register a new organization
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};