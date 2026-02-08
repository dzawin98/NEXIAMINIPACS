import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/services/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Edit, Loader2, Save, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Settings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // --- Users State & Queries ---
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: adminApi.getUsers,
  });

  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: adminApi.getRoles,
  });

  // --- Mutations ---
  const createUserMutation = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User created successfully' });
      setIsUserDialogOpen(false);
      resetUserForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating user', description: error.message, variant: 'destructive' });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, user }: { id: number; user: any }) => adminApi.updateUser(id, user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User updated successfully' });
      setIsUserDialogOpen(false);
      resetUserForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating user', description: error.message, variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting user', description: error.message, variant: 'destructive' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ name, permissions }: { name: string; permissions: string[] }) => 
      adminApi.updateRolePermissions(name, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast({ title: 'Role permissions updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating role', description: error.message, variant: 'destructive' });
    },
  });

  // --- UI State ---
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');

  const resetUserForm = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setRole('');
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setUsername(user.username);
    setPassword(''); // Don't fill password
    setRole(user.role);
    setIsUserDialogOpen(true);
  };

  const handleSaveUser = () => {
    if (!username || !role) {
      toast({ title: 'Username and Role are required', variant: 'destructive' });
      return;
    }
    if (!editingUser && !password) {
      toast({ title: 'Password is required for new users', variant: 'destructive' });
      return;
    }

    const userData = {
      username,
      password: password || undefined,
      role
    };

    if (editingUser) {
      updateUserMutation.mutate({ 
        id: editingUser.id, 
        user: userData 
      });
    } else {
      createUserMutation.mutate(userData);
    }
  };

  const handleDeleteUser = (id: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      deleteUserMutation.mutate(id);
    }
  };

  const handlePermissionChange = (roleName: string, currentPermissions: any, permission: string, checked: boolean) => {
    let perms: string[] = [];
    
    // Handle both array and string formats of permissions
    if (Array.isArray(currentPermissions)) {
      perms = [...currentPermissions];
    } else if (typeof currentPermissions === 'string') {
      try {
        perms = JSON.parse(currentPermissions);
      } catch {
        perms = [];
      }
    }

    if (checked) {
      if (!perms.includes(permission)) perms.push(permission);
    } else {
      perms = perms.filter((p: string) => p !== permission);
    }
    updateRoleMutation.mutate({ name: roleName, permissions: perms });
  };

  const isPermissionChecked = (permissions: any, permission: string) => {
    if (Array.isArray(permissions)) {
      return permissions.includes(permission);
    }
    if (typeof permissions === 'string') {
      try {
        const parsed = JSON.parse(permissions);
        return Array.isArray(parsed) && parsed.includes(permission);
      } catch {
        return false;
      }
    }
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header 
        title="Settings" 
        subtitle="Manage users, roles, and system configuration"
      />
      <div className="flex-1 space-y-8 p-8 pt-6">
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="roles">Role Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Users</CardTitle>
                  <CardDescription>Manage users and their roles.</CardDescription>
                </div>
                <Dialog open={isUserDialogOpen} onOpenChange={(open) => {
                  setIsUserDialogOpen(open);
                  if (!open) resetUserForm();
                }}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Add User</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="username">Username</Label>
                        <Input 
                          id="username" 
                          value={username} 
                          onChange={(e) => setUsername(e.target.value)} 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="password">Password {editingUser && '(Leave blank to keep current)'}</Label>
                        <Input 
                          id="password" 
                          type="password" 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)} 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={role} onValueChange={setRole}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles?.map((r: any) => (
                              <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveUser} disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                        {(createUserMutation.isPending || updateUserMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.role}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteUser(user.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Role Permissions</CardTitle>
                <CardDescription>Configure access rights for each role.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingRoles ? (
                  <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                ) : (
                  <div className="space-y-6">
                    {roles?.map((role: any) => (
                      <div key={role.name} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                        <div className="w-1/4 font-medium">{role.name}</div>
                        <div className="flex-1 flex gap-6">
                          {['Modify', 'Delete', 'View'].map((perm) => (
                            <div key={perm} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`${role.name}-${perm}`} 
                                checked={isPermissionChecked(role.permissions, perm.toLowerCase())}
                                onCheckedChange={(checked) => handlePermissionChange(role.name, role.permissions, perm.toLowerCase(), checked as boolean)}
                              />
                              <Label htmlFor={`${role.name}-${perm}`}>{perm}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
