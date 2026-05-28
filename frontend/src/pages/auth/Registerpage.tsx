import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { setAuthLandingPath, useAuth } from '../../lib/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Link, useNavigate } from 'react-router-dom';

// ── Organization registration schema (matches TenantRegistrationRequest DTO) ──
const orgSchema = z.object({
  name: z.string().min(2, "Organization name is required"),
  subdomain: z.string().min(2, "Subdomain is required")
      .regex(/^[a-z0-9-]+$/, "Subdomain must be lowercase letters, numbers, or hyphens"),
  adminFirstName: z.string().min(1, "First name is required"),
  adminLastName: z.string().min(1, "Last name is required"),
  adminEmail: z.string().email("Invalid email"),
  adminPassword: z.string().min(6, "Password must be at least 6 characters"),
});

// ── User registration schema (matches UserRegistrationRequest DTO) ──
// No organization/tenant field — tenant is resolved automatically
// (subdomain in production, X-Tenant-ID default in local dev)
const userSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type OrgFormValues = z.infer<typeof orgSchema>;
type UserFormValues = z.infer<typeof userSchema>;

type RegistrationType = 'choose' | 'organization' | 'user';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [regType, setRegType] = useState<RegistrationType>('choose');

  // ── Organization registration ──
  const orgForm = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
  });

  const orgMutation = useMutation({
    mutationFn: (data: OrgFormValues) => {
      // POST /api/v1/tenants/register — no X-Tenant-ID needed
      return api.post('/tenants/register', data);
    },
    onSuccess: async (_resp, variables) => {
      // Auto-login after tenant creation
      try {
        const authResp = await api.post(
          '/auth/login',
          { email: variables.adminEmail, password: variables.adminPassword },
          { headers: { 'X-Tenant-ID': variables.subdomain } }
        );
        setAuthLandingPath('/admin');
        login(authResp.data.token);
        navigate('/admin', { replace: true });
      } catch (e: any) {
        alert("Registration successful, but auto-login failed. Please login manually.");
        navigate('/login');
      }
    },
    onError: (error: any) => {
      alert("Registration failed: " + (error.response?.data?.message || "Unknown error"));
    }
  });

  // ── User registration ──
  const userForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
  });

  const userMutation = useMutation({
    mutationFn: (data: UserFormValues) => {
      // POST /api/v1/auth/register — X-Tenant-ID is auto-set by api.ts
      // (subdomain in production, 'demo' default in local dev)
      return api.post('/auth/register', {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
    },
    onSuccess: (response) => {
      setAuthLandingPath('/library');
      login(response.data.token);
      navigate('/library', { replace: true });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error
        || error.response?.data?.message
        || "Registration failed. Please try again.";
      alert(message);
    },
  });

  // ── Step 1: Choose registration type ──
  if (regType === 'choose') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Register
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Choose how you want to get started
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setRegType('organization')}
              className="w-full flex flex-col items-start p-5 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <span className="text-lg font-semibold text-gray-900">Continue as Organization</span>
              <span className="text-sm text-gray-500 mt-1">
                Create a new audio library for your organization. You'll be the admin.
              </span>
            </button>

            <button
              onClick={() => setRegType('user')}
              className="w-full flex flex-col items-start p-5 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <span className="text-lg font-semibold text-gray-900">Continue as User</span>
              <span className="text-sm text-gray-500 mt-1">
                Join an existing library as a listener. Browse, stream, and build playlists.
              </span>
            </button>
          </div>

          <div className="text-center text-sm">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2A: Organization registration form ──
  if (regType === 'organization') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Create your Audio Library
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Set up a new organization. You'll be the admin.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={orgForm.handleSubmit((data) => orgMutation.mutate(data))}>
            <div className="space-y-4 rounded-md shadow-sm">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Organization Name</label>
                <Input id="name" {...orgForm.register("name")} placeholder="Grace Church" className="mt-1" />
                {orgForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{orgForm.formState.errors.name.message}</p>}
              </div>

              <div>
                <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">Subdomain</label>
                <div className="flex mt-1">
                  <Input id="subdomain" {...orgForm.register("subdomain")} placeholder="grace" className="rounded-r-none" />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                    .audiolib.com
                  </span>
                </div>
                {orgForm.formState.errors.subdomain && <p className="text-red-500 text-xs mt-1">{orgForm.formState.errors.subdomain.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="adminFirstName" className="block text-sm font-medium text-gray-700">First Name</label>
                  <Input id="adminFirstName" {...orgForm.register("adminFirstName")} placeholder="John" className="mt-1" />
                  {orgForm.formState.errors.adminFirstName && <p className="text-red-500 text-xs mt-1">{orgForm.formState.errors.adminFirstName.message}</p>}
                </div>
                <div>
                  <label htmlFor="adminLastName" className="block text-sm font-medium text-gray-700">Last Name</label>
                  <Input id="adminLastName" {...orgForm.register("adminLastName")} placeholder="Pastor" className="mt-1" />
                  {orgForm.formState.errors.adminLastName && <p className="text-red-500 text-xs mt-1">{orgForm.formState.errors.adminLastName.message}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">Admin Email</label>
                <Input id="adminEmail" type="email" {...orgForm.register("adminEmail")} placeholder="admin@grace.com" className="mt-1" />
                {orgForm.formState.errors.adminEmail && <p className="text-red-500 text-xs mt-1">{orgForm.formState.errors.adminEmail.message}</p>}
              </div>

              <div>
                <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700">Password</label>
                <Input id="adminPassword" type="password" {...orgForm.register("adminPassword")} className="mt-1" />
                {orgForm.formState.errors.adminPassword && <p className="text-red-500 text-xs mt-1">{orgForm.formState.errors.adminPassword.message}</p>}
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full" disabled={orgMutation.isLoading}>
                {orgMutation.isLoading ? 'Creating...' : 'Create Organization'}
              </Button>
            </div>

            <div className="text-center space-y-2">
              <div className="text-sm">
                <button type="button" onClick={() => setRegType('choose')} className="font-medium text-blue-600 hover:text-blue-500">
                  ← Back to registration options
                </button>
              </div>
              <div className="text-sm">
                <Link to="/login" className="font-medium text-gray-500 hover:text-gray-700">
                  Already have an account? Sign in
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Step 2B: User registration form ──
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

        <form className="mt-8 space-y-6" onSubmit={userForm.handleSubmit((data) => userMutation.mutate(data))}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name</label>
                <Input id="firstName" {...userForm.register("firstName")} placeholder="Mary" className="mt-1" />
                {userForm.formState.errors.firstName && <p className="text-red-500 text-xs mt-1">{userForm.formState.errors.firstName.message}</p>}
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last Name</label>
                <Input id="lastName" {...userForm.register("lastName")} placeholder="Smith" className="mt-1" />
                {userForm.formState.errors.lastName && <p className="text-red-500 text-xs mt-1">{userForm.formState.errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
              <Input id="email" type="email" {...userForm.register("email")} placeholder="mary@example.com" className="mt-1" />
              {userForm.formState.errors.email && <p className="text-red-500 text-xs mt-1">{userForm.formState.errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <Input id="password" type="password" {...userForm.register("password")} placeholder="At least 8 characters" className="mt-1" />
              {userForm.formState.errors.password && <p className="text-red-500 text-xs mt-1">{userForm.formState.errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <Input id="confirmPassword" type="password" {...userForm.register("confirmPassword")} className="mt-1" />
              {userForm.formState.errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{userForm.formState.errors.confirmPassword.message}</p>}
            </div>
          </div>

          <div>
            <Button type="submit" className="w-full" disabled={userMutation.isLoading}>
              {userMutation.isLoading ? 'Creating account...' : 'Create Account'}
            </Button>
          </div>

          <div className="text-center space-y-2">
            <div className="text-sm">
              <button type="button" onClick={() => setRegType('choose')} className="font-medium text-blue-600 hover:text-blue-500">
                ← Back to registration options
              </button>
            </div>
            <div className="text-sm">
              <Link to="/login" className="font-medium text-gray-500 hover:text-gray-700">
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};