import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Link, useNavigate } from 'react-router-dom';

const registerSchema = z.object({
  subdomain: z.string().min(2, "Organization subdomain is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const UserRegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: RegisterFormValues) => {
      return api.post(
        '/auth/register',
        {
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
        },
        {
          headers: { 'X-Tenant-ID': data.subdomain },
        }
      );
    },
    onSuccess: (response) => {
      login(response.data.token);
      navigate('/library');
    },
    onError: (error: any) => {
      const message = error.response?.data?.error
        || error.response?.data?.message
        || "Registration failed. Please try again.";
      alert(message);
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    mutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join as a listener to browse, stream, and build playlists
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">
                Organization
              </label>
              <Input
                id="subdomain"
                {...form.register("subdomain")}
                placeholder="demo"
                className="mt-1"
              />
              {form.formState.errors.subdomain && (
                <p className="text-red-500 text-xs mt-1">
                  {form.formState.errors.subdomain.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <Input
                  id="firstName"
                  {...form.register("firstName")}
                  placeholder="John"
                  className="mt-1"
                />
                {form.formState.errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <Input
                  id="lastName"
                  {...form.register("lastName")}
                  placeholder="Doe"
                  className="mt-1"
                />
                {form.formState.errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="john@example.com"
                className="mt-1"
              />
              {form.formState.errors.email && (
                <p className="text-red-500 text-xs mt-1">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Input
                id="password"
                type="password"
                {...form.register("password")}
                placeholder="At least 8 characters"
                className="mt-1"
              />
              {form.formState.errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                {...form.register("confirmPassword")}
                className="mt-1"
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Button type="submit" className="w-full" disabled={mutation.isLoading}>
              {mutation.isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </div>

          <div className="text-center space-y-2">
            <div className="text-sm">
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Already have an account? Sign in
              </Link>
            </div>
            <div className="text-sm">
              <Link to="/signup" className="font-medium text-gray-500 hover:text-gray-700">
                Want to register a new organization? Sign up here
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};