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

const signupSchema = z.object({
  name: z.string().min(2, "Company name is required"),
  subdomain: z.string().min(2, "Subdomain is required").regex(/^[a-z0-9-]+$/, "Subdomain must be lowercase, numbers, or hyphens"),
  adminFirstName: z.string().min(1, "First name is required"),
  adminLastName: z.string().min(1, "Last name is required"),
  adminEmail: z.string().email("Invalid email"),
  adminPassword: z.string().min(6, "Password must be at least 6 characters"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export const SignupPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: SignupFormValues) => {
      return api.post('/tenants/register', data);
    },
    onSuccess: async (_resp, variables) => {
      // Auto-login and send the user straight to the Admin page for first-run UX.
      try {
        const authResp = await api.post(
          '/auth/login',
          { email: variables.adminEmail, password: variables.adminPassword },
          { headers: { 'X-Tenant-ID': variables.subdomain } }
        );
        login(authResp.data.token);
        navigate('/admin');
      } catch (e: any) {
        const status = e?.response?.status;
        const msg = e?.response?.data?.message || e?.message || "Unknown error";
        alert(`Registration successful, but auto-login failed (${status ?? "no status"}): ${msg}. Please login manually.`);
        navigate('/login');
      }
    },
    onError: (error: any) => {
      alert("Registration failed: " + (error.response?.data?.message || "Unknown error"));
    }
  });

  const onSubmit = (data: SignupFormValues) => {
    mutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Create your Audio Library
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Start your free trial today
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Company Name</label>
              <Input id="name" {...form.register("name")} placeholder="Acme Corp" className="mt-1" />
              {form.formState.errors.name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>}
            </div>
            
            <div>
              <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">Subdomain</label>
              <div className="flex mt-1">
                <Input id="subdomain" {...form.register("subdomain")} placeholder="acme" className="rounded-r-none" />
                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                  .audiolib.com
                </span>
              </div>
              {form.formState.errors.subdomain && <p className="text-red-500 text-xs mt-1">{form.formState.errors.subdomain.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="fname" className="block text-sm font-medium text-gray-700">First Name</label>
                    <Input id="fname" {...form.register("adminFirstName")} placeholder="John" className="mt-1" />
                    {form.formState.errors.adminFirstName && <p className="text-red-500 text-xs mt-1">{form.formState.errors.adminFirstName.message}</p>}
                </div>
                <div>
                    <label htmlFor="lname" className="block text-sm font-medium text-gray-700">Last Name</label>
                    <Input id="lname" {...form.register("adminLastName")} placeholder="Doe" className="mt-1" />
                    {form.formState.errors.adminLastName && <p className="text-red-500 text-xs mt-1">{form.formState.errors.adminLastName.message}</p>}
                </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Admin Email</label>
              <Input id="email" type="email" {...form.register("adminEmail")} placeholder="admin@acme.com" className="mt-1" />
              {form.formState.errors.adminEmail && <p className="text-red-500 text-xs mt-1">{form.formState.errors.adminEmail.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <Input id="password" type="password" {...form.register("adminPassword")} className="mt-1" />
              {form.formState.errors.adminPassword && <p className="text-red-500 text-xs mt-1">{form.formState.errors.adminPassword.message}</p>}
            </div>
          </div>

          <div>
            <Button type="submit" className="w-full" disabled={mutation.isLoading}>
              {mutation.isLoading ? 'Creating...' : 'Register Tenant'}
            </Button>
          </div>
          <div className="text-center text-sm">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Already have an account? Log in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

